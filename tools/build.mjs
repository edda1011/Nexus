import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {allowed} from '../static-assets.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
// An explicit list keeps server code, database files and secrets out of the CDN.
for(const file of allowed){
  let bytes;
  try{bytes=await readFile(path.join(root,file));}catch(error){
    if(error.code!=='ENOENT'||file!=='/assets/general-sans.woff2')throw error;
    // Obtain the licensed font from Fontshare during deployment, not from Git.
    const response=await fetch('https://api.fontshare.com/v2/css?f[]=general-sans@1&display=swap',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Could not fetch General Sans from Fontshare.');
    const css=await response.text(),source=css.match(/url\('([^']+\.woff2)'\)/)?.[1];
    if(!/font-weight:\s*200 700/.test(css)||!source)throw new Error('Unexpected Fontshare variable font response.');
    const url=new URL(source,'https://api.fontshare.com');
    if(url.protocol!=='https:'||url.hostname!=='cdn.fontshare.com')throw new Error('Unexpected font download host.');
    const font=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!font.ok)throw new Error('Could not download General Sans.');
    bytes=Buffer.from(await font.arrayBuffer());
    if(bytes.toString('ascii',0,4)!=='wOF2'||bytes.length>2000000)throw new Error('Invalid General Sans WOFF2.');
  }
  const destination=path.join(root,'public',file);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);
}
console.log('Prepared '+allowed.size+' public assets. Private files are excluded.');
