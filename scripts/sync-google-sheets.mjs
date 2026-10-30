import fs from 'node:fs/promises';
import path from 'node:path';
import {loadProperties} from './properties.mjs';
import {readStatuses,mergeStatuses} from './property-statuses.mjs';
const root=path.resolve(import.meta.dirname,'..');
async function sync(){
 const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 const snapshot=JSON.parse(event.inputs?.snapshot ?? 'null');
 if(snapshot?.spreadsheetId!=='1aYpGYOCeG_dhmMP2B6PWWjTOn7G68xo37tjG873v9kw')throw new Error('Tableau source incorrect');
 if(!Number.isSafeInteger(snapshot.capturedAt)||snapshot.capturedAt<=0||snapshot.capturedAt>Date.now()+300000)throw new Error('Date de capture incorrecte');
 const metaPath=path.join(root,'data/property-status-sync.json');
 const meta=await fs.readFile(metaPath,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return {capturedAt:0};throw error;});
 if(snapshot.capturedAt<=meta.capturedAt){console.log('Capture ancienne ignorée.');return;}
 const next=mergeStatuses(snapshot.values,await loadProperties(root),await readStatuses(root));
 const target=path.join(root,'data/property-statuses.json');
 await fs.writeFile(target+'.tmp',JSON.stringify(next,null,2)+'\n');
 await fs.rename(target+'.tmp',target);
 await fs.writeFile(metaPath,JSON.stringify({capturedAt:snapshot.capturedAt},null,2)+'\n');
 console.log('Statuts Apps Script validés.');
}
sync().catch(error=>{console.error(error.message);process.exitCode=1;});
