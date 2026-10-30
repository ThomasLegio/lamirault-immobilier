import fs from 'node:fs/promises';
import path from 'node:path';
export const labels={active:'En vente',under_offer:'Sous compromis',sold:'Vendu',archived:'Annonce archivée'};
const statusByLabel={'En vente':'active','Sous compromis':'under_offer','Vendu':'sold'};
export async function readStatuses(root){
 try{return JSON.parse(await fs.readFile(path.join(root,'data/property-statuses.json'),'utf8'));}
 catch(error){if(error.code==='ENOENT')return {};throw error;}
}
export function mergeStatuses(values,properties,previous){
 if(!Array.isArray(values)||!values.length)throw new Error('Tableau Google vide ou invalide');
 const headers=values[0];
 if(headers[0]!== 'Référence de l’annonce (interne)' || headers[6]!=='Statut')throw new Error('Colonnes Référence / Statut déplacées ou renommées');
 const known=new Set(properties.map(p=>String(p.reference)));
 if(known.size!==properties.length)throw new Error('Références internes dupliquées dans les annonces');
 const next={...previous},seen=new Set();
 for(const [index,row] of values.slice(1).entries()){
  const ref=String(row[0]??'').trim(),label=String(row[6]??'').trim();
  if(!ref){if(label)throw new Error(`Référence absente ligne ${index+2}`);continue;}
  if(seen.has(ref))throw new Error(`Référence dupliquée : ${ref}`);
  seen.add(ref);
  if(!known.has(ref))throw new Error(`Référence inconnue : ${ref}`);
  if(!label)continue;
  if(!Object.hasOwn(statusByLabel,label))throw new Error(`Statut invalide pour ${ref}`);
  next[ref]=statusByLabel[label];
 }
 return Object.fromEntries(Object.entries(next).sort(([a],[b])=>a.localeCompare(b)));
}
