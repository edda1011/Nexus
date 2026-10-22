export const LIVE_WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=3.0738&longitude=101.5183&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability,precipitation,shortwave_radiation&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKuala_Lumpur&forecast_days=14';
export const LIVE_MAX_AGE=90*60*1000;
const finite=(v,min=-Infinity,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
export function normaliseLiveWeather(raw, fetchedAt=new Date().toISOString()){
  if(raw?.timezone!=='Asia/Kuala_Lumpur'||raw.utc_offset_seconds!==28800)throw new Error('Unexpected forecast timezone.');
  const c=raw.current,d=raw.daily,h=raw.hourly;
  if(!c||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.time)||!finite(c.temperature_2m,-60,65)||!finite(c.relative_humidity_2m,0,100)||!finite(c.precipitation,0)||!finite(c.wind_speed_10m,0)||!finite(c.weather_code,0,99)||![0,1].includes(c.is_day)||!finite(c.interval,1))throw new Error('Incomplete current weather; no invented replacements.');
  const date=Date.parse(c.time+'+08:00');if(!Number.isFinite(date)||!Number.isFinite(Date.parse(fetchedAt)))throw new Error('Invalid source timestamp.');
  if(raw.current_units?.temperature_2m!=='°C'||raw.current_units?.precipitation!=='mm'||raw.daily_units?.precipitation_sum!=='mm'||raw.daily_units?.et0_fao_evapotranspiration!=='mm')throw new Error('Unexpected weather units.');
  if(d?.time?.[0]!==c.time.slice(0,10))throw new Error('Forecast window does not match current source date.');
  if(!Array.isArray(d?.time)||d.time.length!==14||new Set(d.time).size!==14)throw new Error('A complete 14-day forecast is required.');
  d.time.forEach((v,i)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||(i&&Date.parse(v)-Date.parse(d.time[i-1])!==86400000))throw new Error('Invalid forecast date sequence.');});
  for(const key of ['precipitation_sum','et0_fao_evapotranspiration','temperature_2m_max','temperature_2m_min'])if(!Array.isArray(d[key])||d[key].length!==14||!d[key].every(v=>finite(v,key.includes('temperature')?-60:0,key.includes('temperature')?65:Infinity)))throw new Error('Incomplete daily forecast.');
  if(!Array.isArray(h?.time)||!h.time.length||!['temperature_2m','precipitation_probability','precipitation'].every(k=>Array.isArray(h[k])&&h[k].length===h.time.length&&h[k].every(v=>finite(v,k==='temperature_2m'?-60:0,k==='precipitation_probability'?100:Infinity))))throw new Error('Incomplete hourly forecast.');
  const hours=h.time.map((time,i)=>({time,temperature:h.temperature_2m[i],probability:h.precipitation_probability[i],rain:h.precipitation[i]})).filter(v=>Date.parse(v.time+'+08:00')>=date).slice(0,48);
  if(hours.length<12)throw new Error('Hourly outlook is unavailable.');
  let solar=[];
  if(h.shortwave_radiation!==undefined){
    if(raw.hourly_units?.shortwave_radiation!=='W/m²'||!Array.isArray(h.shortwave_radiation)||h.shortwave_radiation.length!==h.time.length||!h.shortwave_radiation.every(v=>finite(v,0,1500)))throw new Error('Invalid solar irradiance forecast.');
    const tomorrow=d.time[1];solar=h.time.map((time,i)=>({time,radiation:h.shortwave_radiation[i]})).filter(v=>v.time.startsWith(tomorrow)).slice(0,24);
    if(solar.length!==24)throw new Error('A complete next-day irradiance profile is required.');
  }
  return {source:'Open-Meteo · current model and forecast',sourceUrl:LIVE_WEATHER_URL,fetchedAt,observedAt:new Date(date).toISOString(),timezone:raw.timezone,latitude:raw.latitude,longitude:raw.longitude,current:{...c},current_units:{...raw.current_units},daily:structuredClone(d),daily_units:{...raw.daily_units},hours,solar,mode:'current'};
}
export function isLiveFresh(data,now=Date.now()){
  const age=now-Date.parse(data?.observedAt),retrieval=now-Date.parse(data?.fetchedAt);
  return data?.mode==='current'&&Number.isFinite(age)&&age>=-30*60000&&age<=LIVE_MAX_AGE&&Number.isFinite(retrieval)&&retrieval>=-60000&&retrieval<=LIVE_MAX_AGE;
}
export const weatherDescription=code=>code===0?'Clear sky':code<=3?'Cloud cover':code<=48?'Mist or fog':code<=57?'Drizzle':code<=67?'Rain':code<=77?'Snow':code<=82?'Rain showers':code<=86?'Snow showers':'Thunderstorms';
