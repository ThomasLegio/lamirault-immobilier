import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadProperties,escapeHtml} from './properties.mjs';
import {extractClassified,normalizeClassified,agencyUrl} from './import-seloger.mjs';
const root=path.resolve(import.meta.dirname,'..');
const properties=await loadProperties(root);
const inventory=JSON.parse(await fs.readFile(path.join(root,'data/seloger-inventory.json'),'utf8'));
assert.equal(inventory.urls.length,inventory.expectedCount,'Inventaire incomplet');
assert.equal(new Set(inventory.urls).size,inventory.urls.length,'Inventaire dupliqué');
for(const url of inventory.urls)assert(properties.some(p=>p.source===url),`Annonce non importée : ${url}`);
const header=await fs.readFile(path.join(root,'shared/header.html'),'utf8');
const footer=await fs.readFile(path.join(root,'shared/footer.html'),'utf8');
const routes=JSON.parse(await fs.readFile(path.join(root,'content/pages.json'),'utf8')).map(p=>p.route);
routes.push('biens',...properties.map(p=>`biens/${p.slug}`));
for(const route of [...routes,'404.html']){
  const file=route==='404.html'?route:path.join(route,'index.html');
  const html=await fs.readFile(path.join(root,file),'utf8');
  assert(html.includes(header),`Header différent : ${file}`);
  assert(html.includes(footer),`Footer différent : ${file}`);
  assert.equal((html.match(/<footer class="li-footer">/g)||[]).length,1,`Footer dupliqué : ${file}`);
  assert(html.includes('id="dmRoot"'),`Racine CSS manquante : ${file}`);
  assert.equal((html.match(/class="li-breadcrumb"/g)||[]).length,1,`Fil d’Ariane absent ou dupliqué : ${file}`);
  assert(!html.includes('data-element-type="ssrbreadcrumbs"'),`Ancien fil d’Ariane encore présent : ${file}`);
  const breadcrumb=html.match(/<nav class="li-breadcrumb"[^>]*>(.*?)<\/nav>/s)?.[1];
  assert.equal((breadcrumb.match(/aria-current="page"/g)||[]).length,1,`Page courante ambiguë : ${file}`);
  for(const link of breadcrumb.matchAll(/href="([^"]+)"/g)){
    assert(link[1].startsWith('/'),`Lien externe dans le fil d’Ariane : ${file}`);
    await fs.access(path.join(root,link[1],'index.html'));
  }
}
const catalogue=await fs.readFile(path.join(root,'biens/index.html'),'utf8');
assert.equal((catalogue.match(/class="property-card"/g)||[]).length,properties.filter(p=>['active','under_offer'].includes(p.status)).length);
let photoCount=0;
const sourceIndex=process.argv.indexOf('--source-dir');
const sourceDir=sourceIndex>=0?process.argv[sourceIndex+1]:null;
for(const p of properties){
  assert.equal(p.sourceAgency,agencyUrl);
  assert(p.source.endsWith('/'+p.id));
  const html=await fs.readFile(path.join(root,'biens',p.slug,'index.html'),'utf8');
  if(p.status==='sold'){
    assert(!catalogue.includes(`/biens/${p.slug}/`));
    assert(html.includes('http-equiv="refresh"'));
    assert(!html.includes('data-gallery-thumbnail'));
    continue;
  }
  assert(html.includes(escapeHtml(p.source)));
  assert(html.includes(`Référence du bien : <strong>${escapeHtml(p.reference)}</strong>`));
  assert.equal((html.match(/data-gallery-thumbnail /g)||[]).length,p.photos.length);
  assert.equal(new Set(p.photos.map(photo=>photo.src)).size,p.photos.length,`Chemins de photos dupliqués : ${p.id}`);
  assert(catalogue.includes(`/biens/${p.slug}/`) || p.status==='archived');
  for(const photo of p.photos){
    const bytes=await fs.readFile(path.join(root,photo.src));
    assert(bytes.length>1000,`Image vide : ${photo.src}`);
    assert(bytes[0]===0xff&&bytes[1]===0xd8 || bytes.subarray(1,4).toString()==='PNG' || bytes.subarray(0,4).toString()==='RIFF',`Image invalide : ${photo.src}`);
    photoCount++;
  }
  if(sourceDir){
    const raw=extractClassified(await fs.readFile(path.join(sourceDir,p.id+'.html'),'utf8'));
    const expected=normalizeClassified(raw,p.source,p);
    for(const key of ['title','description','price','priceDetails','feeNote','city','livingArea','overallArea','plotArea','rooms','bedrooms','features','energy','photos']) assert.deepEqual(p[key],expected[key],`Écart avec la source : ${p.id} / ${key}`);
  }
}
// Confirm that every local link and image on the new pages resolves in the generated site.
for(const route of ['biens',...properties.map(p=>`biens/${p.slug}`)]){
  const html=await fs.readFile(path.join(root,route,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){
    const target=match[1];
    await fs.access(path.join(root,target.endsWith('/')?target+'index.html':target));
  }
}
console.log(`OK : ${properties.length} fiches, ${photoCount} photos, ${routes.length+1} pages avec le même header/footer et un fil d’Ariane unique, liens locaux valides${sourceDir?', données conformes aux sources':''}.`);
