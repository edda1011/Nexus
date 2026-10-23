import {timingSafeEqual} from 'node:crypto';
import {sha,ACCOUNT_ROLES,INPUT_KINDS} from './store.mjs';
const reject=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const cookie=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nexus_session='))?.slice(14);
function send(res,status,body,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(body));}
async function readBody(req){
  if(!req.headers['content-type']?.startsWith('application/json'))reject('Send application/json.',415);
  let bytes=0,parts=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>512000)reject('Request too large.',413);parts.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(parts).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{reject('Invalid JSON object.');}
}
export function createApi(store,{getWeather,services=null,originFor=req=>'http://'+req.headers.host,secureCookies=false,clientAddress=req=>req.socket.remoteAddress}){
  return async(req,res,url)=>{
    const service=url.pathname.match(/^\/api\/services\/(status|warnings|electricity|flood|thingspeak|route)$/)?.[1];
    if(!service&&!['/api/session','/api/login','/api/logout','/api/workspace','/api/water/action','/api/energy/action','/api/rides/action','/api/telemetry','/api/evidence','/api/integrity'].includes(url.pathname))return false;
    try{
      if(!['GET','POST'].includes(req.method))reject('Method not allowed.',405);
      if(req.headers.origin&&req.headers.origin!==originFor(req))reject('Cross-origin requests are not accepted.',403);
      const session=await store.session(cookie(req));
      if(service){
        if(req.method!=='GET')reject('Method not allowed.',405);
        if(!services)reject('External services are unavailable.',503);
        if(service==='thingspeak'&&services.privateThingSpeak){if(!session)reject('Sign in as manager, staff or auditor to read the private ThingSpeak channel.',401);store.allowed(session.user,['manager','staff','auditor']);}
        const result=await services.get(service,url.searchParams.get('corridor')||'school');send(res,result.status==='invalid'?400:200,result);return true;
      }
      if(url.pathname==='/api/session'&&req.method==='GET'){send(res,200,{user:session?.user??null,csrf:session?.csrf??null,expires:session?.expires??null,accounts:ACCOUNT_ROLES,version:'0.6.0',inputKinds:INPUT_KINDS});return true;}
      if(url.pathname==='/api/login'&&req.method==='POST'){
        const ip=clientAddress(req);if(!await store.loginAttempt(ip))reject('Too many sign-in attempts. Wait one minute.',429);
        const body=await readBody(req);if(typeof body.username!=='string'||typeof body.password!=='string'||body.password.length>256)reject('Enter a username and password.');
        const login=await store.login(body.username,body.password);await store.clearLoginAttempts(ip);
        send(res,200,{user:login.user,csrf:login.csrf,expires:login.expires},{'Set-Cookie':`nexus_session=${login.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secureCookies?'; Secure':''}`});return true;
      }
      if(url.pathname==='/api/telemetry'&&req.method==='POST'&&req.headers.authorization?.startsWith('Bearer ')){
        const supplied=sha(req.headers.authorization.slice(7)),expected=store.deviceTokenHash;
        if(!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))reject('Invalid device token.',401);
        send(res,200,await store.ingest(await readBody(req),{username:'registered-device',role:'device'},{provider:true}));return true;
      }
      if(!session)reject('Sign in to use the server workspace.',401);
      if(req.method==='POST'&&req.headers['x-nexus-csrf']!==session.csrf)reject('Session protection token is missing. Refresh and retry.',403);
      const actor=session.user;
      if(url.pathname==='/api/logout'&&req.method==='POST'){await store.logout(cookie(req),actor);send(res,200,{ok:true},{'Set-Cookie':`nexus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`});return true;}
      if(url.pathname==='/api/workspace'&&req.method==='GET'){send(res,200,await store.workspace(actor));return true;}
      if(url.pathname==='/api/integrity'&&req.method==='GET'){send(res,200,await store.verifyAudit());return true;}
      if(url.pathname==='/api/evidence'&&req.method==='GET'){store.allowed(actor,['manager','auditor','staff']);send(res,200,await store.export());return true;}
      if(url.pathname==='/api/telemetry'&&req.method==='POST'){const result=await store.ingest(await readBody(req),actor);send(res,200,{...result,workspace:await store.workspace(actor)});return true;}
      if(req.method==='POST'&&url.pathname.endsWith('/action')){
        const {scenario,revision,action,payload={}}=await readBody(req);
        if(typeof action!=='string'||!payload||typeof payload!=='object'||Array.isArray(payload))reject('Invalid action payload.');
        let weather=null;
        if(['approve','live-inputs'].includes(action)||url.pathname==='/api/energy/action'||url.pathname==='/api/rides/action'){
          try{weather=await getWeather();}catch{if(scenario==='live'&&['approve','live-inputs'].includes(action))reject('Current public forecast unavailable. Reconnect before approval.',503);}
        }
        let record;
        if(url.pathname==='/api/water/action')record=await store.waterAction(scenario,revision,actor,action,payload,weather);
        else if(url.pathname==='/api/energy/action')record=await store.energyAction(revision,actor,action,payload,weather);
        else record=await store.ridesAction(revision,actor,action,payload,weather);
        send(res,200,{record,workspace:await store.workspace(actor)});return true;
      }
      reject('Method not allowed.',405);
    }catch(error){send(res,error.code?503:(error.status||400),{error:error.code?'Database temporarily unavailable. Retry shortly.':error.status===500?'Internal server error.':error.message});return true;}
  };
}
