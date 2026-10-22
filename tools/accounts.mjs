import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=process.env.NEXUS_DATA_DIR||fileURLToPath(new URL('../.nexus/',import.meta.url));
try{const {accounts}=JSON.parse(readFileSync(path.join(directory,'bootstrap.json'),'utf8'));console.log('Local prototype accounts. Keep these passwords private.');for(const [user,password] of Object.entries(accounts))console.log(user+': '+password);}
catch{console.error('Start NEXUS once with npm start to generate the local accounts.');process.exitCode=1;}
