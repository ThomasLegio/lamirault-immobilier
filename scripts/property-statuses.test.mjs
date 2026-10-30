import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeStatuses} from './property-statuses.mjs';
import {propertyPages,renderCatalogue} from './properties.mjs';
import fs from 'node:fs';
const header=['Référence de l’annonce (interne)','','','','','','Statut'];
const properties=[{reference:'1'},{reference:'2'}];
const row=(ref,status)=>[ref,'','','','','',status];
test('applique les trois statuts',()=>{
 for(const [label,status] of [['En vente','active'],['Sous compromis','under_offer'],['Vendu','sold']])
 assert.equal(mergeStatuses([header,row('1',label)],properties,{})['1'],status);
});
test('préserve les statuts pour une ligne supprimée ou un statut vide',()=>{
 assert.deepEqual(mergeStatuses([header,row('1','')],properties,{'1':'sold','2':'under_offer'}),{'1':'sold','2':'under_offer'});
});
test('refuse les données invalides sans modifier le dernier état',()=>{
 const old={'1':'active'};
 for(const values of [[],[['mauvais en-tête']], [header,row('1','Erreur')],[header,row('1','Vendu'),row('1','En vente')],[header,row('9','Vendu')],[header,row('','Vendu')]]){
 assert.throws(()=>mergeStatuses(values,properties,old));assert.deepEqual(old,{'1':'active'});
 }
});
const p=JSON.parse(fs.readFileSync(new URL('../data/biens/265U6QSAMBT5.json',import.meta.url)));
test('sous compromis reste visible dans le catalogue et la fiche',()=>{
 const item={...p,status:'under_offer'};
 assert.match(renderCatalogue([item]),/Sous compromis/);
 assert.match(propertyPages([item])[1].html,/Sous compromis/);
});
test('vendu disparaît du catalogue et sa fiche devient une redirection sans détails',()=>{
 const item={...p,status:'sold'};
 assert.ok(!renderCatalogue([item]).includes(`/biens/${p.slug}/`));
 const page=propertyPages([item])[1];
 assert.match(page.html,/http-equiv="refresh"/);assert.match(page.head,/noindex/);
 assert.ok(!page.html.includes('data-gallery-thumbnail'));
});
