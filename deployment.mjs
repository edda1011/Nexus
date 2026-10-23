export function deploymentConfig(env=process.env){
  const production=env.VERCEL==='1'||env.NODE_ENV==='production',port=Number(env.PORT||5173);
  const origins=production?[
    env.NEXUS_PUBLIC_ORIGIN,
    env.VERCEL_URL&&'https://'+env.VERCEL_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL&&'https://'+env.VERCEL_PROJECT_PRODUCTION_URL
  ].filter(Boolean):['http://localhost:'+port,'http://127.0.0.1:'+port];
  for(const origin of origins){const url=new URL(origin);if(url.origin!==origin||(production&&url.protocol!=='https:'))throw new Error('NEXUS_PUBLIC_ORIGIN must be an HTTPS origin with no trailing slash.');}
  if(production&&(!env.DATABASE_URL||!env.NEXUS_SIGNING_KEY||!origins.length))throw new Error('Production requires DATABASE_URL, NEXUS_SIGNING_KEY and a public origin (Vercel supplies its deployment origins automatically).');
  return {production,port,originFor(req){return origins.find(origin=>new URL(origin).host===req.headers.host);},clientAddress(req){return env.VERCEL==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;}};
}
