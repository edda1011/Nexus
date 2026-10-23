import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Store} from '../store.mjs';
import {PostgresDatabase} from '../database.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function migrateToPostgres(source,target){
  return source.db.transaction(async()=>target.transaction(async()=>{
    const audit=await source.verifyAudit();if(!audit.valid)throw new Error('Local audit integrity failed; migration stopped.');
    await target.exec(readFileSync(new URL('../data/postgres-schema.sql',import.meta.url),'utf8'));
    const existing=await target.prepare("SELECT value FROM nexus_meta WHERE key='fingerprint'").get();
    if(existing){
      if(existing.value!==source.fingerprint)throw new Error('Target database belongs to another signing identity. Nothing was overwritten.');
      return {alreadyInitialised:true,fingerprint:existing.value};
    }
    const tables=['users','records','audit','batches','telemetry','credits'];
    for(const table of [...tables,'sessions','login_attempts']){
      const count=await target.prepare('SELECT COUNT(*) AS n FROM '+table).get();if(Number(count.n))throw new Error('Target database is not empty. Nothing was overwritten.');
    }
    const counts={};
    for(const table of tables){
      const rows=await source.db.prepare('SELECT * FROM '+table).all();counts[table]=rows.length;
      for(const row of rows){
        const columns=Object.keys(row);
        await target.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...Object.values(row));
      }
    }
    await target.exec("SELECT setval(pg_get_serial_sequence('telemetry','id'), COALESCE((SELECT MAX(id) FROM telemetry),0)+1, false)");
    const meta=target.prepare('INSERT INTO nexus_meta VALUES(?,?)');
    await meta.run('fingerprint',source.fingerprint);await meta.run('deviceTokenHash',source.deviceTokenHash);await meta.run('checkpoint',JSON.stringify(await source.checkpoint()));
    return {alreadyInitialised:false,counts,fingerprint:source.fingerprint};
  }));
}

async function main(){
  const envFile=path.join(root,'.env');
  try{process.loadEnvFile(envFile);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!process.env.DATABASE_URL)throw new Error('Add DATABASE_URL to your local .env first.');
  const directory=process.env.NEXUS_DATA_DIR||path.join(root,'.nexus');
  if(!existsSync(path.join(directory,'nexus.sqlite'))||!existsSync(path.join(directory,'signing-private.pem')))throw new Error('Existing local database and signing key are required. Start NEXUS locally once before migration.');
  let source,target,cloud;
  try{
    source=await Store.open(directory);
    const signingKey=readFileSync(path.join(directory,'signing-private.pem')).toString('base64');
    if(process.env.NEXUS_SIGNING_KEY&&process.env.NEXUS_SIGNING_KEY!==signingKey)throw new Error('NEXUS_SIGNING_KEY differs from the original local key. Nothing was migrated.');
    // Save the durable identity locally BEFORE committing the cloud migration. Never print it.
    if(!process.env.NEXUS_SIGNING_KEY){
      let text=readFileSync(envFile,'utf8');
      text=text.replace(/^NEXUS_SIGNING_KEY=.*(?:\r?\n|$)/m,'');
      writeFileSync(envFile,text.trimEnd()+'\nNEXUS_SIGNING_KEY='+signingKey+'\n',{mode:0o600});
    }
    target=new PostgresDatabase(process.env.DATABASE_URL);
    const result=await migrateToPostgres(source,target);
    await target.close();target=null;
    cloud=await Store.open(null,{databaseUrl:process.env.DATABASE_URL,signingKey});
    const check=await cloud.verifyAudit();if(!check.valid)throw new Error('Cloud integrity verification failed.');
    console.log(result.alreadyInitialised?'Database already initialised; existing cloud data was retained.':'Local accounts, records, telemetry, credits and signed audit migrated to Postgres. Local data was retained.');
    console.log('Cloud audit verified. Signing identity: '+check.fingerprint);
    console.log('NEXUS_SIGNING_KEY is saved privately in .env. Existing account passwords still apply. Local browser sessions are not migrated; sign in again on the hosted site.');
  }finally{await cloud?.close();await target?.close();await source?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error.code?'Database setup failed ('+error.code+'). Check network/database availability; no credentials were printed.':error.message);process.exitCode=1;});
}
