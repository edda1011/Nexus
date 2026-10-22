import {createHash,verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const hash=v=>createHash('sha256').update(v).digest('hex');
export function verifyEvidence(data,pinnedFingerprint=null){
  if(data?.format!=='NEXUS-SIGNED-EVIDENCE-1'||!Array.isArray(data.events)||!data.publicKey)throw new Error('Unknown evidence format.');
  const fingerprint=hash(data.publicKey);if(pinnedFingerprint&&pinnedFingerprint!==fingerprint)throw new Error('The signing identity differs from the pinned fingerprint.');
  let previous='GENESIS';
  for(let i=0;i<data.events.length;i++){
    const {hash:digest,signature,...body}=data.events[i];
    if(body.seq!==i+1||body.previous!==previous||hash(JSON.stringify(body))!==digest||!verify(null,Buffer.from(digest),data.publicKey,Buffer.from(signature,'base64')))throw new Error('Invalid audit event '+(i+1));
    previous=digest;
  }
  const {signature,...checkpoint}=data.checkpoint||{};
  if(checkpoint.count!==data.events.length||checkpoint.tail!==previous||checkpoint.fingerprint!==fingerprint||!verify(null,Buffer.from(JSON.stringify(checkpoint)),data.publicKey,Buffer.from(signature||'','base64')))throw new Error('Checkpoint mismatch, missing tail, or invalid signature.');
  for(const record of data.records||[]){
    const last=data.events.filter(e=>e.stream===record.id).at(-1);
    if(record.revision>0&&(!last||JSON.stringify(JSON.parse(last.payload).state)!==JSON.stringify(record.value)))throw new Error('Record snapshot differs from the signed event: '+record.id);
  }
  for(const event of data.events.filter(e=>e.stream==='telemetry'&&e.action==='batch-imported')){
    const batch=JSON.parse(event.payload),readings=(data.telemetry||[]).filter(r=>r.batchId===batch.batchId).map(r=>({assetId:r.assetId,kind:r.kind,at:r.at,value:r.value,unit:r.unit})).sort((a,b)=>(a.assetId+a.kind+a.at).localeCompare(b.assetId+b.kind+b.at));
    if(readings.length!==batch.rows||hash(JSON.stringify({source:batch.source,class:batch.class,readings}))!==batch.hash)throw new Error('Telemetry differs from signed batch '+batch.batchId);
  }
  return {valid:true,count:data.events.length,fingerprint,identityPinned:!!pinnedFingerprint,note:pinnedFingerprint?'Verified against the supplied signing identity.':'Cryptographic consistency verified. Pin the fingerprint separately to establish identity; this does not certify physical outcomes.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{if(!process.argv[2])throw new Error('Usage: node verify-evidence.mjs evidence.json [pinned-sha256-fingerprint]');console.log(JSON.stringify(verifyEvidence(JSON.parse(readFileSync(process.argv[2],'utf8')),process.argv[3]),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
