export const SERVICE_URLS={
  warnings:'https://api.data.gov.my/weather/warning/?limit=100',
  electricity:'https://api.data.gov.my/data-catalogue/?id=electricity_consumption&filter=total@sector&sort=-date&limit=24',
  flood:'https://flood-api.open-meteo.com/v1/flood?latitude=3.0738&longitude=101.5183&daily=river_discharge&forecast_days=14&timezone=GMT'
};
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const fail=message=>{throw new Error(message);};
const myt=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v))return null;const date=Date.parse(/[Zz]|[+-]\d{2}:\d{2}$/.test(v)?v:v+'+08:00');return Number.isFinite(date)?new Date(date).toISOString():null;};
const clean=(v,max=12000)=>typeof v==='string'?v.trim().slice(0,max):'';

export function normaliseWarnings(raw){
  if(!Array.isArray(raw))fail('The official warning response is not a record collection.');
  const notices=raw.filter(r=>/^no advisory$/i.test(clean(r?.heading_en))&&r.valid_from===null&&r.valid_to===null).map(r=>({title:clean(r.heading_en),issuedAt:myt(r.warning_issue?.issued),text:clean(r.text_en||r.text_bm)}));
  if(notices.some(r=>!r.issuedAt))fail('An official notice has no issue timestamp.');
  const rows=raw.filter(r=>!(/^no advisory$/i.test(clean(r?.heading_en))&&r.valid_from===null&&r.valid_to===null)).map(r=>({issuedAt:myt(r?.warning_issue?.issued),validFrom:myt(r?.valid_from),validTo:myt(r?.valid_to),title:clean(r?.heading_en||r?.warning_issue?.title_en||r?.heading_bm,300),text:clean(r?.text_en||r?.text_bm),instruction:clean(r?.instruction_en||r?.instruction_bm,2000)}));
  if(rows.some(r=>!r.issuedAt||!r.validFrom||!r.validTo||Date.parse(r.validTo)<Date.parse(r.validFrom)||!r.title))fail('An official warning has missing validity or title fields.');
  rows.sort((a,b)=>Date.parse(b.issuedAt)-Date.parse(a.issuedAt));
  return {rows,notices,sourceTime:[...rows,...notices].map(r=>r.issuedAt).sort().at(-1)??null,scope:'Malaysia national feed · latest 100 records; read the stated affected area',classification:'official advisory',source:'MET Malaysia via data.gov.my',sourceUrl:SERVICE_URLS.warnings,disclosure:'National and marine advisories may not apply to Shah Alam. This feed does not classify local site safety or automatically approve/cancel work.'};
}
export function normaliseElectricity(raw){
  if(!Array.isArray(raw)||!raw.length)fail('Monthly electricity statistics are unavailable.');
  const rows=raw.filter(r=>r?.sector==='total').map(r=>({date:r.date,value:r.consumption}));
  if(!rows.length||rows.some(r=>!validDate(r.date)||!r.date.endsWith('-01')||!finite(r.value))||new Set(rows.map(r=>r.date)).size!==rows.length)fail('Monthly electricity dates, sector or values are incomplete.');
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return {rows,sourceTime:rows.at(-1).date,unit:'million kWh / month',scope:'Malaysia · total sector',classification:'official monthly statistics',source:'data.gov.my · electricity consumption',sourceUrl:SERVICE_URLS.electricity,disclosure:'National monthly statistics, not this building’s electricity meter. Latest six months may be revised. No conversion into site savings.'};
}
export function normaliseFlood(raw){
  const dates=raw?.daily?.time,values=raw?.daily?.river_discharge;
  if(raw?.utc_offset_seconds!==0||raw?.daily_units?.river_discharge!=='m³/s'||!Array.isArray(dates)||dates.length!==14||!Array.isArray(values)||values.length!==dates.length||!Number.isFinite(raw.latitude)||!Number.isFinite(raw.longitude))fail('River model has missing dates, coordinates or units.');
  if(dates.some((d,i)=>!validDate(d)||(i&&Date.parse(d)-Date.parse(dates[i-1])!==86400000))||values.some(v=>v!==null&&!finite(v)))fail('River model has invalid dates or discharge values.');
  if(values.every(v=>v===null))fail('No river-discharge model values are available at this grid cell.');
  return {rows:dates.map((date,i)=>({date,value:values[i]})),sourceTime:dates[0],unit:'m³/s',latitude:raw.latitude,longitude:raw.longitude,scope:'Grid near Shah Alam · approximately 5 km resolution · UTC model dates',classification:'public hydrological model',source:'Open-Meteo · GloFAS river discharge',sourceUrl:SERVICE_URLS.flood,disclosure:'Modelled river flow, not a water-level sensor, tank stock or street-flood alert. The selected grid may not represent the intended local river; no safety threshold is inferred.'};
}
export function normaliseThingSpeak(raw,config){
  const channel=raw?.channel,key='field'+config.field;
  if(!channel||String(channel.id)!==config.channelId||!Array.isArray(raw.feeds)||typeof channel[key]!=='string')fail('ThingSpeak channel or selected field is unavailable. Check the channel ID, field and read permission.');
  const rows=raw.feeds.map(r=>{const value=r[key],date=typeof r.created_at==='string'?Date.parse(r.created_at):NaN;return {at:Number.isFinite(date)?new Date(date).toISOString():null,value:typeof value==='string'&&value.trim()!==''?Number(value):typeof value==='number'?value:null};}).filter(r=>r.at&&r.value!==null&&Number.isFinite(r.value));
  rows.sort((a,b)=>a.at.localeCompare(b.at));
  if(!rows.length)fail('The selected ThingSpeak field has no numeric readings. Missing values are not replaced with zero.');
  return {rows,name:clean(channel.name,200)||'Channel '+config.channelId,field:clean(channel[key],200),unit:config.unit||'unit not configured',channelId:config.channelId,sourceTime:rows.at(-1).at,maxAgeMinutes:config.maxAgeMinutes,scope:clean(channel.description,500)||'Location and instrument not independently verified',classification:'provider-reported reference stream',source:'ThingSpeak channel '+config.channelId,sourceUrl:'https://thingspeak.mathworks.com/channels/'+config.channelId,disclosure:'Read-only reference stream. Field names and location are channel-owner metadata. No automatic mapping to Tank A, no import into the site ledger, and no independent measurement certification.'};
}
export function normaliseRoute(raw,corridor){
  const feature=raw?.features?.[0],summary=feature?.properties?.summary,points=feature?.geometry?.coordinates;
  if(feature?.geometry?.type!=='LineString'||!finite(summary?.distance)||!finite(summary?.duration)||!Array.isArray(points)||points.length<2||points.length>50000||points.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))fail('The route provider returned an incomplete route.');
  return {corridor,distanceMetres:summary.distance,durationSeconds:summary.duration,coordinates:points.map(p=>p.slice(0,2)),sourceTime:raw?.metadata?.timestamp?new Date(raw.metadata.timestamp).toISOString():null,scope:'Configured endpoints · driving-car profile',classification:'calculated road route',source:'openrouteservice · HeiGIT',sourceUrl:'https://openrouteservice.org/',disclosure:'Calculated route and estimated duration, not live congestion or proof of travel. Kept separate from the approved mission’s assumed distance and rewards.'};
}
const coords=value=>{
  if(!value)return null;
  const parts=value.split(',').map(v=>v.trim());if(parts.length!==2||parts.some(v=>!v))return null;
  const values=parts.map(Number);return values.every(Number.isFinite)&&Math.abs(values[0])<=180&&Math.abs(values[1])<=90?values:null;
};
export function serviceConfig(env=process.env){
  const field=Number(env.NEXUS_THINGSPEAK_FIELD||1),age=Number(env.NEXUS_THINGSPEAK_MAX_AGE_MINUTES||90),channelId=(env.NEXUS_THINGSPEAK_CHANNEL_ID||'').trim();
  return {orsKey:(env.NEXUS_ORS_API_KEY||'').trim(),thingspeak:{channelId,field,unit:clean(env.NEXUS_THINGSPEAK_UNIT,40),readKey:(env.NEXUS_THINGSPEAK_READ_KEY||'').trim(),maxAgeMinutes:age,valid:/^[1-9]\d{0,11}$/.test(channelId)&&Number.isInteger(field)&&field>=1&&field<=8&&Number.isFinite(age)&&age>=1&&age<=10080},routes:Object.fromEntries(['school','office'].map(id=>[id,{start:coords(env['NEXUS_ROUTE_'+id.toUpperCase()+'_START']),end:coords(env['NEXUS_ROUTE_'+id.toUpperCase()+'_END'])}]))};
}

export function createServices({env=process.env,fetcher=fetch,now=Date.now}={}){
  const config=serviceConfig(env),cache=new Map(),flights=new Map();
  const publicConfig=()=>({routingKeyConfigured:!!config.orsKey,routes:Object.fromEntries(Object.entries(config.routes).map(([id,r])=>[id,!!(r.start&&r.end)])),thingspeakConfigured:config.thingspeak.valid,thingspeakPrivate:!!config.thingspeak.readKey,thingspeakField:config.thingspeak.field,setupFile:'.env',attribution:'Open-Meteo / GloFAS; MET Malaysia; data.gov.my; openrouteservice / OpenStreetMap contributors; ThingSpeak channel owner. Respect source licences and free-tier limits.'});
  async function json(url,options={}){
    const response=await fetcher(url,{...options,headers:{Accept:'application/json',...options.headers},signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!response.ok)throw new Error(response.status===429?'Provider rate limit reached. The server will back off.':response.status===401||response.status===403?'Provider access rejected. Check the local key and permissions.':'Provider request failed ('+response.status+').');
    if(Number(response.headers.get('content-length'))>2000000)fail('Provider response exceeded the allowed size.');
    const body=await response.text();if(body.length>2000000)fail('Provider response exceeded the allowed size.');
    try{return JSON.parse(body);}catch{fail('Provider returned invalid JSON.');}
  }
  async function cached(id,ttl,loader){
    const previous=cache.get(id),time=now();
    if(previous&&time<previous.nextAt)return {...previous.result,cache:'server cache'};
    if(flights.has(id))return flights.get(id);
    const promise=(async()=>{
      let result;
      try{const data=await loader();result={id,status:'available',data,fetchedAt:new Date(now()).toISOString(),checkedAt:new Date(now()).toISOString()};cache.set(id,{result,nextAt:now()+ttl});}
      catch(error){const message=['TimeoutError','AbortError'].includes(error.name)?'Provider timed out. Try checking the connection again.':error.message==='fetch failed'?'Could not reach the provider. Retry after checking the connection.':error.message;result={id,status:previous?.result?.data?'stale':'unavailable',data:previous?.result?.data??null,fetchedAt:previous?.result?.fetchedAt??null,checkedAt:new Date(now()).toISOString(),message};cache.set(id,{result,nextAt:now()+60000});}
      return result;
    })().finally(()=>flights.delete(id));flights.set(id,promise);return promise;
  }
  async function get(id,corridor='school'){
    if(id==='status')return publicConfig();
    if(id==='warnings')return cached(id,5*60000,async()=>normaliseWarnings(await json(SERVICE_URLS.warnings)));
    if(id==='electricity')return cached(id,24*3600000,async()=>normaliseElectricity(await json(SERVICE_URLS.electricity)));
    if(id==='flood')return cached(id,3600000,async()=>normaliseFlood(await json(SERVICE_URLS.flood)));
    if(id==='thingspeak'){
      if(!config.thingspeak.valid)return {id,status:'not_configured',message:'Set NEXUS_THINGSPEAK_CHANNEL_ID and a valid field in the local .env file, then restart the server.'};
      const url=new URL('https://api.thingspeak.com/channels/'+config.thingspeak.channelId+'/feeds.json');url.searchParams.set('results','60');if(config.thingspeak.readKey)url.searchParams.set('api_key',config.thingspeak.readKey);
      return cached(id,60000,async()=>normaliseThingSpeak(await json(url),config.thingspeak));
    }
    if(id==='route'){
      const route=config.routes[corridor];if(!route)return {id,status:'invalid',message:'Choose the school or office corridor.'};
      if(!config.orsKey||!route.start||!route.end)return {id,status:'not_configured',message:'Set the free NEXUS_ORS_API_KEY and this corridor’s start/end longitude,latitude in .env, then restart. No route is fabricated.'};
      return cached(id+':'+corridor,3600000,async()=>normaliseRoute(await json('https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson',{method:'POST',headers:{Accept:'application/geo+json, application/json','Content-Type':'application/json',Authorization:config.orsKey},body:JSON.stringify({coordinates:[route.start,route.end],instructions:false})}),corridor));
    }
    return {id,status:'invalid',message:'Unknown public service.'};
  }
  return {get,publicConfig,privateThingSpeak:!!config.thingspeak.readKey};
}
