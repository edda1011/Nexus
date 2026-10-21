import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normaliseForecast, WEATHER_URL } from './weather.js';
import {normaliseLiveWeather, LIVE_WEATHER_URL, isLiveFresh} from './live.js';
const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PORT||5173);
const allowed=new Set(['/live.css','/motion.js','/live.js','/index.html','/app.js','/engine.js','/data.js','/style.css','/assets/nexus-mark.svg','/assets/nexus-logo.svg','/assets/nexus-logo-light.svg','/assets/manrope.ttf','/assets/FONT-LICENSE.txt','/data/climate-july-2025.json','/data/metmalaysia-snapshot.json']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json','.txt':'text/plain'};
let cache=null,inFlight=null;
async function forecast(){
  if(cache&&Date.now()-cache.cachedAt<600000)return cache.payload;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
    try{
      const response=await fetch(WEATHER_URL,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`Public API returned ${response.status}`);
      const payload={mode:'refreshed',source:'MET Malaysia via data.gov.my',sourceUrl:WEATHER_URL,retrievedAt:new Date().toISOString(),records:normaliseForecast(await response.json())};
      cache={cachedAt:Date.now(),payload};return payload;
    }catch{
      if(cache)return{...cache.payload,mode:'cached',notice:'Refresh unavailable; showing the last successful retrieval.'};
      const saved=JSON.parse(await readFile(path.join(root,'data/metmalaysia-snapshot.json'),'utf8'));
      return{...saved,mode:'snapshot',records:normaliseForecast(saved.records),notice:'Refresh unavailable; retained public snapshot with original retrieval time.'};
    }finally{inFlight=null;}
  })();return inFlight;
}

let liveCache=null,liveFlight=null;
async function liveForecast(){
  if(liveCache&&Date.now()-liveCache.cachedAt<60000)return {...liveCache.payload,mode:!liveCache.failed&&isLiveFresh(liveCache.payload)?'current':'stale',delivery:'server cache'};
  if(liveFlight)return liveFlight;
  liveFlight=(async()=>{
    try{
      const response=await fetch(LIVE_WEATHER_URL,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Weather source unavailable');
      const payload=normaliseLiveWeather(await response.json());
      liveCache={cachedAt:Date.now(),payload};return {...payload,mode:isLiveFresh(payload)?'current':'stale',delivery:'public API'};
    }catch{
      if(liveCache){liveCache.failed=true;liveCache.cachedAt=Date.now();return {...liveCache.payload,mode:'stale',notice:'The source could not be refreshed. Last successful values are shown with their original time.'};}
      throw new Error('No live weather available. Retry when the public source is reachable.');
    }finally{liveFlight=null;}
  })();return liveFlight;
}

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/api/live-weather'){
      try{const payload=await liveForecast();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
      catch(error){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:error.message,mode:'unavailable'}));}
      return;
    }
    if(pathname==='/api/weather'){
      const payload=await forecast();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));return;
    }
    const file=pathname==='/'?'/index.html':pathname;
    if(!allowed.has(file)){res.writeHead(404);res.end('Not found');return;}
    const bytes=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':`${mime[path.extname(file)]}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);
  }catch{res.writeHead(500);res.end('Unable to load this resource');}
});
server.listen(port,'127.0.0.1',()=>console.log(`NEXUS Studio is ready at http://localhost:${port}`));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Stop the previous preview or choose another PORT.`:error.message);process.exitCode=1;});
