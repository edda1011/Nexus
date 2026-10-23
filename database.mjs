import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import pg from 'pg';

// Keep one transaction context per request. A pool-wide BEGIN would mix users' writes.
export class Database {
  context=new AsyncLocalStorage();
  queue=Promise.resolve();
  constructor(filename){this.kind='sqlite';this.native=new DatabaseSync(filename);}
  async exec(sql){this.native.exec(sql);}
  prepare(sql){const statement=this.native.prepare(sql);return Object.fromEntries(['get','all','run'].map(method=>[method,async(...args)=>statement[method](...args)]));}
  async transaction(fn,afterCommit){
    if(this.context.getStore())return fn();
    const prior=this.queue;let release;this.queue=new Promise(resolve=>{release=resolve;});await prior;
    try{return await this.context.run(true,async()=>{
      this.native.exec('BEGIN IMMEDIATE');let result;
      try{result=await fn();this.native.exec('COMMIT');}catch(error){this.native.exec('ROLLBACK');throw error;}
      await afterCommit?.();return result;
    });}finally{release();}
  }
  async close(){await this.queue;this.native.close();}
}

export class PostgresDatabase {
  context=new AsyncLocalStorage();
  constructor(connectionString,{schema='public'}={}){
    if(!/^[a-z][a-z0-9_]*$/.test(schema))throw new Error('Invalid database schema.');
    this.kind='postgres';this.schema=schema;
    const url=new URL(connectionString);
    if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
    // Verify TLS certificates, including when the copied Neon URL uses sslmode=require.
    for(const key of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])url.searchParams.delete(key);
    this.pool=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000,allowExitOnIdle:true});
    this.pool.on('error',()=>console.error('PostgreSQL idle connection closed; the next request will reconnect.'));
  }
  async query(sql,args=[]){
    const client=this.context.getStore();
    if(client)return client.query(sql,args);
    if(this.schema!=='public')return this.transaction(()=>this.query(sql,args));
    return this.pool.query(sql,args);
  }
  async exec(sql){await this.query(sql);}
  prepare(sql){
    let n=0;sql=sql.replaceAll('?',()=>'$'+(++n));
    return {get:async(...args)=>(await this.query(sql,args)).rows[0],all:async(...args)=>(await this.query(sql,args)).rows,run:async(...args)=>({changes:(await this.query(sql,args)).rowCount})};
  }
  async transaction(fn){
    if(this.context.getStore())return fn();
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      if(this.schema!=='public')await client.query('SET LOCAL search_path TO '+this.schema);
      // ponytail: one township serialises audit writes; partition locks by tenant before multi-tenant scaling.
      await client.query('SELECT pg_advisory_xact_lock(782943615)');
      const result=await this.context.run(client,fn);await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async close(){await this.pool.end();}
}
