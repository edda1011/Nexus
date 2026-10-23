import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../store.mjs';
import {createApi} from '../api.mjs';

test('HTTPS login and logout keep Secure cookies, exact-origin checks and shared login throttling',async t=>{
 const store=await Store.open(mkdtempSync(path.join(tmpdir(),'nexus-https-test-')),{testPassword:'test-only-long-password'});
 const api=createApi(store,{getWeather:async()=>null,secureCookies:true,originFor:()=> 'https://nexus.example'});
 const server=http.createServer(async(req,res)=>{await api(req,res,new URL(req.url,'https://nexus.example'));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();});
 const base='http://127.0.0.1:'+server.address().port;
 async function login(origin,password='test-only-long-password'){return fetch(base+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'manager',password})});}
 assert.equal((await login('http://nexus.example')).status,403);assert.equal((await login('https://attacker.example')).status,403);
 const response=await login('https://nexus.example'),session=await response.json(),cookie=response.headers.get('set-cookie');assert.equal(response.status,200);assert.match(cookie,/; Secure/);
 const logout=await fetch(base+'/api/logout',{method:'POST',headers:{Origin:'https://nexus.example',Cookie:cookie.split(';')[0],'Content-Type':'application/json','X-Nexus-CSRF':session.csrf},body:'{}'});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/; Secure/);
 for(let i=0;i<15;i++)assert.equal((await login('https://nexus.example','wrong')).status,401);
 assert.equal((await login('https://nexus.example','wrong')).status,429);
});
test('HTTP sessions, CSRF, roles, device provenance and signed export enforce trust boundaries',async t=>{
 const store=await Store.open(mkdtempSync(path.join(tmpdir(),'nexus-api-test-')),{testPassword:'test-only-long-password'}),api=createApi(store,{getWeather:async()=>null});
 const server=http.createServer(async(req,res)=>{if(!await api(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));(await store.close());});
 const base='http://127.0.0.1:'+server.address().port;
 async function call(url,body,headers={}){return fetch(base+url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',...headers}:headers,body:body?JSON.stringify(body):undefined});}
 assert.equal((await call('/api/workspace')).status,401);
 assert.equal((await call('/api/login',{username:'manager',password:'wrong'})).status,401);
 assert.equal((await call('/api/login',{username:'manager',password:'test-only-long-password'},{Origin:'https://untrusted.example'})).status,403);
 const login=await call('/api/login',{username:'manager',password:'test-only-long-password'}),session=await login.json(),setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);
 const headers={Cookie:setCookie.split(';')[0],'X-Nexus-CSRF':session.csrf};
 assert.equal((await call('/api/water/action',{scenario:'dry',revision:0,action:'approve'},{Cookie:headers.Cookie})).status,403);
 assert.equal((await call('/api/water/action',{scenario:'dry',revision:0,action:'approve',actor:{username:'staff',role:'staff'},payload:{}},headers)).status,200);
 assert.equal((await call('/api/water/action',{scenario:'dry',revision:0,action:'approve',payload:{}},headers)).status,409);
 assert.equal((await call('/api/water/action',{scenario:'dry',revision:1,action:'task',payload:{task:'inspect'}},headers)).status,403);
 const point={batchId:'authenticated-device-batch',source:'Test gateway',readings:[{assetId:'tank-a',kind:'tank-volume',at:new Date().toISOString(),value:42,unit:'m³'}]};
 assert.equal((await call('/api/telemetry',point,{Authorization:'Bearer invalid-token'})).status,401);
 assert.equal((await call('/api/telemetry',point,{Authorization:'Bearer '+store.bootstrap.deviceToken})).status,200);
 const data=await (await call('/api/workspace',null,headers)).json();assert.equal(data.readings[0].class,'provider');assert.equal(data.water.dry.status,'MOBILISED');
 const evidence=await (await call('/api/evidence',null,headers)).json();assert.ok(evidence.publicKey);assert.ok(evidence.checkpoint.signature);assert.ok(!JSON.stringify(evidence).includes(store.bootstrap.deviceToken));assert.ok(!JSON.stringify(evidence).includes(session.csrf));
 assert.equal((await call('/api/logout',{},headers)).status,200);assert.equal((await call('/api/workspace',null,headers)).status,401);
});

test('external service endpoints enforce methods, origin and private ThingSpeak role boundaries',async t=>{
 const store=await Store.open(mkdtempSync(path.join(tmpdir(),'nexus-services-http-')),{testPassword:'test-only-long-password'}),calls=[];
 const services={privateThingSpeak:true,get:async(id,corridor)=>{calls.push({id,corridor});return {id,status:'available',data:{source:'test provider'}};}};
 const api=createApi(store,{getWeather:async()=>null,services});
 const server=http.createServer(async(req,res)=>{if(!await api(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));(await store.close());});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/services/flood')).status,200);
 assert.equal((await fetch(base+'/api/services/flood',{method:'POST'})).status,405);
 assert.equal((await fetch(base+'/api/services/warnings',{headers:{Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await fetch(base+'/api/services/thingspeak')).status,401);
 for(const [username,status] of [['rider',403],['manager',200],['auditor',200]]){
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-only-long-password'})});
  const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/services/thingspeak',{headers:{Cookie:cookie}})).status,status);
 }
 assert.equal(calls.filter(r=>r.id==='thingspeak').length,2);
});
