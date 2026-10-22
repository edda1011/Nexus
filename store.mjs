import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual,createHash,generateKeyPairSync,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {initialState,SCENARIOS,transition,getScenario,dailyModel,round,evaluate} from './engine.js';
import {energyInitial,ridesInitial,energyTransition,ridesTransition,detectAnomalies,evaluateEnergy,evaluateRides} from './platform.js';

export const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const iso=()=>new Date().toISOString();
const token=()=>randomBytes(32).toString('base64url');
export const ACCOUNT_ROLES={manager:'Township manager',staff:'Facilities / nursery staff',driver:'Resident driver',rider:'Resident passenger',auditor:'Read-only auditor'};
export const INPUT_KINDS={'tank-volume':{unit:'m³',max:60},'water-use':{unit:'m³/day',max:100000},'water-delivery':{unit:'m³',max:40},'grid-import':{unit:'kWh/day',max:100000},'solar-generation':{unit:'kWh/day',max:100000},'traffic-count':{unit:'vehicles/hour',max:100000},'soil-moisture':{unit:'%',max:100}};
const ASSET_KINDS={'tank-a':['tank-volume','water-delivery'],'zone-b':['water-use','soil-moisture'],'community-hall':['grid-import','solar-generation'],'school-corridor':['traffic-count'],'office-corridor':['traffic-count']};
export class Store {
  constructor(directory,{testPassword=null}={}){
    mkdirSync(directory,{recursive:true});this.directory=directory;this.db=new DatabaseSync(path.join(directory,'nexus.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY,role TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES users(username),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,at TEXT NOT NULL,actor TEXT NOT NULL,role TEXT NOT NULL,stream TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL,signature TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
      CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,source TEXT NOT NULL,class TEXT NOT NULL,received_at TEXT NOT NULL,rows INTEGER NOT NULL,hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS telemetry(id INTEGER PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES batches(id),asset_id TEXT NOT NULL,kind TEXT NOT NULL,at TEXT NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,UNIQUE(asset_id,kind,at));
      CREATE TRIGGER IF NOT EXISTS telemetry_no_update BEFORE UPDATE ON telemetry BEGIN SELECT RAISE(ABORT,'Telemetry is append-only; submit a correction batch'); END;
      CREATE TRIGGER IF NOT EXISTS telemetry_no_delete BEFORE DELETE ON telemetry BEGIN SELECT RAISE(ABORT,'Telemetry cannot be deleted through the application'); END;
      CREATE TABLE IF NOT EXISTS credits(id TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES users(username),intervention TEXT NOT NULL,amount INTEGER NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS credits_no_update BEFORE UPDATE ON credits BEGIN SELECT RAISE(ABORT,'Credit awards are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS credits_no_delete BEFORE DELETE ON credits BEGIN SELECT RAISE(ABORT,'Credit awards are append-only'); END;`);
    const privateFile=path.join(directory,'signing-private.pem');
    if(!existsSync(privateFile)){
      if(this.db.prepare('SELECT COUNT(*) AS n FROM audit').get().n)fail('Audit key is missing. Restore the original key; refusing to replace audit identity.',503);
      const keys=generateKeyPairSync('ed25519');writeFileSync(privateFile,keys.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
    }
    this.privateKey=createPrivateKey(readFileSync(privateFile));this.publicKey=createPublicKey(this.privateKey).export({type:'spki',format:'pem'}).toString();
    this.fingerprint=sha(this.publicKey);
    const bootstrap=path.join(directory,'bootstrap.json');
    if(!this.db.prepare('SELECT COUNT(*) AS n FROM users').get().n){
      const credentials={deviceToken:token(),accounts:{}};
      for(const username of Object.keys(ACCOUNT_ROLES)){
        const password=testPassword||token().slice(0,18),salt=randomBytes(16).toString('hex');credentials.accounts[username]=password;
        this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(username,['driver','rider'].includes(username)?'resident':username,salt,scryptSync(password,salt,64).toString('hex'));
      }
      writeFileSync(bootstrap,JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});
    }
    this.bootstrap=JSON.parse(readFileSync(bootstrap,'utf8'));
    for(const scenario of [...Object.keys(SCENARIOS),'live'])this.insertRecord('water:'+scenario,initialState(scenario));
    this.insertRecord('energy',energyInitial());this.insertRecord('rides',ridesInitial());
    const audit=this.verifyAudit();if(!audit.valid)fail('Audit integrity failed at startup: '+audit.reason,503);
  }
  close(){this.db.close();}
  insertRecord(id,value){this.db.prepare('INSERT OR IGNORE INTO records VALUES(?,0,?)').run(id,JSON.stringify(value));}
  read(id){const row=this.db.prepare('SELECT revision,value FROM records WHERE id=?').get(id);if(!row)fail('Unknown record.',404);return {...JSON.parse(row.value),revision:row.revision};}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');this.anchor();return result;}catch(e){try{this.db.exec('ROLLBACK');}catch{}throw e;}}
  append(actor,stream,action,payload){
    const last=this.db.prepare('SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1').get();
    const event={seq:(last?.seq??0)+1,at:iso(),actor:actor.username,role:actor.role,stream,action,payload:JSON.stringify(payload),previous:last?.hash??'GENESIS'};
    const hash=sha(JSON.stringify(event)),signature=sign(null,Buffer.from(hash),this.privateKey).toString('base64');
    this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?,?,?)').run(event.seq,event.at,event.actor,event.role,stream,action,event.payload,event.previous,hash,signature);
  }
  events(){return this.db.prepare('SELECT * FROM audit ORDER BY seq').all();}
  verifyAudit(){
    // ponytail: full-chain verification suits a single-site prototype; use periodic verified checkpoints at scale.
    const rows=this.events();let previous='GENESIS';
    for(let i=0;i<rows.length;i++){
      const {hash,signature,...event}=rows[i];
      if(event.seq!==i+1||event.previous!==previous||sha(JSON.stringify(event))!==hash||!verify(null,Buffer.from(hash),this.publicKey,Buffer.from(signature,'base64')))return {valid:false,count:rows.length,reason:'Invalid chain / signature at record '+(i+1),fingerprint:this.fingerprint};
      previous=hash;
    }
    const anchorFile=path.join(this.directory,'anchor.json');
    if(existsSync(anchorFile)){
      let anchor;try{anchor=JSON.parse(readFileSync(anchorFile,'utf8'));}catch{return {valid:false,reason:'Unreadable external checkpoint'};}
      const {signature,...body}=anchor;
      if(!verify(null,Buffer.from(JSON.stringify(body)),this.publicKey,Buffer.from(signature,'base64'))||body.count>rows.length||(body.count&&rows[body.count-1]?.hash!==body.tail))return {valid:false,count:rows.length,reason:'Checkpoint mismatch / truncated tail',fingerprint:this.fingerprint};
    }
    for(const record of this.db.prepare('SELECT * FROM records WHERE revision>0').all()){
      const last=rows.filter(e=>e.stream===record.id).at(-1);
      if(!last||JSON.stringify(JSON.parse(last.payload).state)!==record.value)return {valid:false,count:rows.length,reason:'Record snapshot differs from signed history: '+record.id};
    }
    const readings=this.telemetry();
    for(const batch of this.db.prepare('SELECT * FROM batches').all()){
      const signed=rows.find(e=>e.stream==='telemetry'&&e.action==='batch-imported'&&JSON.parse(e.payload).batchId===batch.id);
      const points=readings.filter(r=>r.batchId===batch.id).map(r=>({assetId:r.assetId,kind:r.kind,at:r.at,value:r.value,unit:r.unit})).sort((a,b)=>(a.assetId+a.kind+a.at).localeCompare(b.assetId+b.kind+b.at));
      const digest=sha(JSON.stringify({source:batch.source,class:batch.class,readings:points}));
      if(!signed||JSON.parse(signed.payload).hash!==digest||batch.hash!==digest||points.length!==batch.rows)return {valid:false,count:rows.length,reason:'Telemetry batch differs from signed history: '+batch.id};
    }
    return {valid:true,count:rows.length,tail:previous,fingerprint:this.fingerprint,scope:'Append-only application API + SQLite triggers + signed hash chain. A host administrator can alter files/keys; pin exported checkpoints externally for independent verification.'};
  }
  checkpoint(){const check=this.verifyAudit();if(!check.valid)fail('Audit integrity failure: '+check.reason,503);const body={version:1,count:check.count,tail:check.tail,at:iso(),fingerprint:this.fingerprint};return {...body,signature:sign(null,Buffer.from(JSON.stringify(body)),this.privateKey).toString('base64')};}
  anchor(){const checkpoint=this.checkpoint(),target=path.join(this.directory,'anchor.json');writeFileSync(target+'.tmp',JSON.stringify(checkpoint),{mode:0o600});renameSync(target+'.tmp',target);}
  protect(){const audit=this.verifyAudit();if(!audit.valid)fail('Audit integrity failure; writes disabled.',503);}
  login(username,password){
    const row=this.db.prepare('SELECT * FROM users WHERE username=?').get(String(username));
    const salt=row?.salt??'fixed-dummy-login-salt',candidate=scryptSync(String(password),salt,64),expected=row?Buffer.from(row.password_hash,'hex'):Buffer.alloc(64);
    if(!row||!timingSafeEqual(candidate,expected))fail('Incorrect username or password.',401);
    const sessionToken=token(),csrf=token(),expires=Date.now()+2*3600000;
    this.transaction(()=>{this.protect();this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(sessionToken),row.username,csrf,expires);this.append({username:row.username,role:row.role},'session','login',{});});
    return {token:sessionToken,user:{username:row.username,role:row.role},csrf,expires};
  }
  session(value){if(!value||value.length>100)return null;const row=this.db.prepare('SELECT s.*,u.role FROM sessions s JOIN users u ON u.username=s.username WHERE token_hash=? AND expires>?').get(sha(value),Date.now());return row?{user:{username:row.username,role:row.role},csrf:row.csrf,expires:row.expires}:null;}
  logout(value,actor){this.transaction(()=>{this.protect();this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(value));this.append(actor,'session','logout',{});});}
  allowed(actor,roles){if(!actor||!roles.includes(actor.role))fail('Your role cannot perform this action. Required: '+roles.join(' / '),403);}
  mutate(id,revision,actor,action,payload,fn){
    if(!Number.isInteger(revision)||revision<0)fail('A current record revision is required.',409);
    return this.transaction(()=>{
      this.protect();const before=this.read(id);if(before.revision!==revision)fail('This record changed in another session. Refresh before retrying.',409);
      const after=fn(before);after.revision=revision+1;
      this.db.prepare('UPDATE records SET revision=?,value=? WHERE id=? AND revision=?').run(after.revision,JSON.stringify(after),id,revision);
      this.append(actor,id,action,{revision:after.revision,payload,state:after});return after;
    });
  }
  waterAction(scenario,revision,actor,action,payload={},weather=null){
    if(!Object.hasOwn(SCENARIOS,scenario)&&scenario!=='live')fail('Unknown water scenario.');
    const roles={assumptions:['manager'],approve:['manager'],reject:['manager'],cancel:['manager'],reset:['manager'],task:['staff'],fail:['staff'],weigh:['staff'],process:['staff'],book:['resident'],checkin:['resident'],verify:['manager'],'verify-import':['manager'],'live-inputs':['manager'],'site-inputs':['manager']};
    if(!roles[action])fail('Unknown water action.');this.allowed(actor,roles[action]);
    return this.mutate('water:'+scenario,revision,actor,action,payload,before=>{
      const previous=before.events.length;
      if(action==='checkin'&&before.collection.owner!==actor.username)fail('Only the booking owner may check in.',403);
      let next;
      if(action==='reset'){next=initialState(scenario,scenario==='live'?weather:null);next.cycle=(before.cycle??0)+1;}
      else if(action==='site-inputs'){
        if(scenario!=='live'||before.status!=='PENDING_HUMAN_REVIEW')fail('Supplied readings can only update an unapproved Live outlook plan.');
        if(payload.demo===true){next={...before};delete next.siteInputs;}
        else{
          const tank=this.telemetry().filter(r=>r.kind==='tank-volume'&&r.assetId==='tank-a'&&r.class!=='simulation').at(-1);
          if(!tank||Date.now()-Date.parse(tank.at)>90*60000)fail('Import / connect a non-synthetic Tank A reading less than 90 minutes old.');
          const q=payload.qualityReference,r=payload.routeReference,at=Date.parse(payload.qualityAt),expires=Date.parse(payload.qualityExpiresAt);
          if(typeof q!=='string'||q.trim().length<3||q.length>200||typeof r!=='string'||r.trim().length<3||r.length>200||!Number.isFinite(at)||!Number.isFinite(expires)||at>Date.now()||expires<=Date.now()||expires<=at||expires-at>7*86400000||payload.reviewed!==true)fail('Review quality and owner/route references with a valid sample time and expiry within seven days.');
          next={...before,siteInputs:{tank,quality:{reference:q,at:new Date(at).toISOString(),expiresAt:new Date(expires).toISOString(),reviewedBy:actor.username},routeReference:r,reviewedAt:iso()}};
          next.requested=Math.max(0,Math.min(before.requested,Math.floor(tank.value-5)));
        }
        next.events=[...next.events,{sequence:next.events.length+1,day:next.events.at(-1).day,actor:actor.username,action:'Site input review',detail:payload.demo?'Returned draft to declared demo asset assumptions.':'Captured supplied tank batch '+next.siteInputs.tank.batchId+' with operator-reviewed quality / consent references.'}];
      }
      else if(action==='verify-import')next=this.reviewWater(before,payload);
      else {
        let current=before;
        if(action==='task'&&payload.task==='transfer'&&before.siteInputs&&Date.parse(before.siteInputs.quality.expiresAt)<=Date.now())fail('The reviewed quality reference expired. Record an interruption and review a new plan before a transfer.');
        if(action==='approve'&&scenario==='live'&&before.status==='PENDING_HUMAN_REVIEW'){
          // Approval never silently swaps the forecast reviewed by the operator.
          if(!weather||weather.mode!=='current'||weather.observedAt!==before.liveInputs?.observedAt||JSON.stringify(weather.daily)!==JSON.stringify(before.liveInputs?.daily))fail('Forecast changed. Refresh the draft and review it before approval.',409);
          current={...before,liveInputs:structuredClone(weather)};
        }
        if(action==='approve'&&current.siteInputs){
          const latest=this.telemetry().filter(r=>r.kind==='tank-volume'&&r.assetId==='tank-a'&&r.class!=='simulation').at(-1);
          if(!latest||latest.at!==current.siteInputs.tank.at||latest.value!==current.siteInputs.tank.value)fail('Tank evidence changed. Capture and review the latest supplied inputs before approval.',409);
        }
        if(action==='approve'&&evaluate(current).net<0&&String(payload.note||'').trim().length<10)fail('Explain the budget / non-financial reason for a negative-net plan (10 characters minimum).');
        next=transition(current,action,action==='live-inputs'?{data:weather}:payload);
        for(const event of next.events.slice(previous))if(!event.actor.includes('router')&&!event.actor.includes('API'))event.actor=actor.username+' ('+actor.role+')';
      }
      if(action==='book')next.collection.owner=actor.username;
      next.cycle??=before.cycle??0;
      if(action==='weigh'){
        if(!next.collection.owner)fail('A booking owner is required.');
        this.db.prepare('INSERT INTO credits VALUES(?,?,?,?,?)').run(`bioloop:${scenario}:${next.cycle}`,next.collection.owner,'water:'+scenario,next.collection.credits,iso());
      }
      return next;
    });
  }
  reviewWater(before,payload){
    if(before.status!=='MOBILISED'||!Object.values(before.tasks).every(Boolean))fail('Complete all three work orders before reviewing readings.');
    const rows=this.telemetry().filter(r=>r.batchId===payload.batchId&&r.kind==='water-use'&&r.assetId==='zone-b');
    const times=dailyModel(before.scenario,before.liveInputs).map(d=>d.date),byDate=new Map(rows.map(r=>[new Date(Date.parse(r.at)+8*3600000).toISOString().slice(0,10),r]));
    if(rows.length!==14||byDate.size!==14||!times.every(t=>byDate.has(t)))fail('Select a complete 14-day Zone B water-use batch matching this plan window.');
    if(rows.some(r=>r.class==='simulation'))fail('Use the simulation action for synthetic data.');
    const potable=round(rows.reduce((a,r)=>a+r.value,0)),baseline=getScenario(before).baseline;
    const next=structuredClone(before);next.observation={adjustedBaseline:baseline,potable,total:potable,rain:0,avoided:round(baseline-potable),conservation:null,days:14,class:'user-supplied',batchId:payload.batchId,note:'Provider / user supplied potable meter series compared with model baseline. Rainwater delivery and mulch attribution are not proven.'};
    next.status='EVIDENCE_REVIEWED';next.reservation=0;next.events.push({sequence:next.events.length+1,day:Math.max(14,next.events.at(-1).day),actor:'Operator evidence review',action:'Imported meter batch reviewed',detail:next.observation.note+' Batch '+payload.batchId});return next;
  }
  energyAction(revision,actor,action,payload={},weather=null){
    this.allowed(actor,action==='complete'?['staff']:['manager']);
    return this.mutate('energy',revision,actor,action,payload,before=>{
      if(action==='approve'&&payload.reviewKey!==evaluateEnergy(before,weather).reviewKey)fail('Energy source changed. Refresh public data and review the draft before approval.',409);
      if(action==='verify-import')payload={...payload,outcome:this.energyOutcome(payload)};
      return energyTransition(before,action,payload,actor.username,weather);
    });
  }
  energyOutcome(payload){
    const collect=id=>this.telemetry().filter(r=>r.batchId===id&&r.kind==='grid-import'&&r.assetId==='community-hall');
    const baseline=collect(payload.baselineBatch),post=collect(payload.actualBatch);
    for(const rows of [baseline,post]){
      if(rows.length<28||rows.length>31||rows.some(r=>r.class==='simulation'))fail('Both batches need 28–31 real/user-supplied daily grid-import readings.');
      const dates=rows.map(r=>new Date(Date.parse(r.at)+8*3600000).toISOString().slice(0,10)).sort();if(new Set(dates).size!==dates.length||dates.some((d,i)=>i&&Date.parse(d)-Date.parse(dates[i-1])!==86400000))fail('Daily billing-cycle readings must be contiguous and unique.');
    }
    if(payload.baselineBatch===payload.actualBatch||Date.parse(baseline.at(-1).at)>=Date.parse(post[0].at))fail('Baseline must precede the distinct post-intervention cycle.');
    return {baselineKWh:round(baseline.reduce((a,r)=>a+r.value,0)/baseline.length),actualKWh:round(post.reduce((a,r)=>a+r.value,0)/post.length),days:post.length,baselineDays:baseline.length,batchId:payload.baselineBatch+' → '+payload.actualBatch};
  }
  ridesAction(revision,actor,action,payload={},weather=null,now=Date.now()){
    this.allowed(actor,['offer','join','confirm'].includes(action)?['resident']:['manager']);
    return this.mutate('rides',revision,actor,action,payload,before=>{
      if(action==='approve'&&before.trigger==='rain'&&payload.reviewKey!==evaluateRides(before,weather,now).reviewKey)fail('Rain forecast changed. Refresh and review the mission before approval.',409);
      const after=ridesTransition(before,action,payload,actor,weather,now);
      if(after.trip?.status==='CONFIRMED'&&before.trip?.status!=='CONFIRMED')for(const name of [after.trip.driver,after.trip.passenger])this.db.prepare('INSERT INTO credits VALUES(?,?,?,?,?)').run('ride:'+after.trip.id+':'+name,name,'rides:'+after.trip.id,after.trip.credits,iso());
      return after;
    });
  }
  ingest(body,actor,{provider=false}={}){
    this.allowed(actor,provider?['device']:['manager','staff']);
    if(!/^[a-zA-Z0-9_-]{3,80}$/.test(body.batchId)||typeof body.source!=='string'||body.source.trim().length<3||body.source.length>200)fail('Batch ID and a clear source are required.');
    const classification=provider?'provider':body.classification;if(!['provider','user-supplied','simulation'].includes(classification)||(!provider&&classification==='provider'))fail('Choose user-supplied or simulation. Provider class requires the device token.');
    if(!Array.isArray(body.readings)||!body.readings.length||body.readings.length>1000)fail('Upload between 1 and 1,000 readings.');
    const now=Date.now(),keys=new Set();
    for(const r of body.readings){const spec=INPUT_KINDS[r.kind],t=Date.parse(r.at),key=r.assetId+'|'+r.kind+'|'+t;
      if(!spec||!ASSET_KINDS[r.assetId]?.includes(r.kind)||r.unit!==spec.unit||!Number.isFinite(r.value)||r.value<0||r.value>spec.max||!Number.isFinite(t)||!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(r.at)||t>now+5*60000||keys.has(key))fail('Invalid/duplicate reading: check asset, kind, units, value and source timestamp with timezone.');keys.add(key);
    }
    body={...body,readings:body.readings.map(r=>({assetId:r.assetId,kind:r.kind,at:new Date(r.at).toISOString(),value:r.value,unit:r.unit})).sort((a,b)=>(a.assetId+a.kind+a.at).localeCompare(b.assetId+b.kind+b.at))};
    const digest=sha(JSON.stringify({source:body.source,class:classification,readings:body.readings}));
    return this.transaction(()=>{
      this.protect();const existing=this.db.prepare('SELECT hash FROM batches WHERE id=?').get(body.batchId);
      if(existing){if(existing.hash!==digest)fail('This batch ID already has different content.',409);return {batchId:body.batchId,accepted:0,duplicate:true};}
      this.db.prepare('INSERT INTO batches VALUES(?,?,?,?,?,?)').run(body.batchId,body.source,classification,iso(),body.readings.length,digest);
      const insert=this.db.prepare('INSERT INTO telemetry(batch_id,asset_id,kind,at,value,unit) VALUES(?,?,?,?,?,?)');
      try{for(const r of body.readings)insert.run(body.batchId,r.assetId,r.kind,r.at,r.value,r.unit);}catch{fail('An asset already has a reading at that source timestamp. Nothing was imported.',409);}
      this.append(actor,'telemetry','batch-imported',{batchId:body.batchId,source:body.source,class:classification,rows:body.readings.length,hash:digest});return {batchId:body.batchId,accepted:body.readings.length,duplicate:false};
    });
  }
  telemetry(){return this.db.prepare('SELECT t.asset_id AS assetId,t.kind,t.at,t.value,t.unit,t.batch_id AS batchId,b.class,b.source,b.received_at AS receivedAt FROM telemetry t JOIN batches b ON b.id=t.batch_id ORDER BY t.at,t.id').all();}
  workspace(actor){
    const water=Object.fromEntries([...Object.keys(SCENARIOS),'live'].map(k=>[k,this.read('water:'+k)])),readings=this.telemetry();
    return {water,energy:this.read('energy'),rides:this.read('rides'),readings:readings.slice(-500),readingCount:readings.length,batches:this.db.prepare('SELECT id,source,class,received_at AS receivedAt,rows FROM batches ORDER BY received_at DESC').all().map(b=>({...b,kinds:[...new Set(readings.filter(r=>r.batchId===b.id).map(r=>r.kind))]})),audit:this.verifyAudit(),
      credits:this.db.prepare('SELECT username,SUM(amount) AS credits FROM credits GROUP BY username').all().filter(r=>['manager','auditor'].includes(actor.role)||r.username===actor.username),anomalies:detectAnomalies(readings)};
  }
  export(){return {format:'NEXUS-SIGNED-EVIDENCE-1',exportedAt:iso(),publicKey:this.publicKey,checkpoint:this.checkpoint(),events:this.events(),telemetry:this.telemetry(),records:this.db.prepare('SELECT * FROM records ORDER BY id').all().map(r=>({...r,value:JSON.parse(r.value)})),disclosure:'Application-append-only, cryptographically tamper-evident under the pinned signing identity. Not absolute immutability against the machine administrator. Operational examples and synthetic outcomes remain labelled.'};}
}
