/** Import saved public SeLoger pages. No AI calls, browser session, or account credentials. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
export const agencyUrl = 'https://www.seloger.com/professionnels-immobilier/KYJUjgFwx7VwAGZYPnmavQ';
export const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const number = text => {
  if (typeof text === 'number') return text;
  const match = String(text ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

export function extractClassified(html) {
  const match = html.match(/<script\b[^>]*\bid=["']__UFRN_LIFECYCLE_SERVERREQUEST__["'][^>]*>([\s\S]*?)<\/script>/i);
  const json = match?.[1].match(/JSON\.parse\(("(?:[^"\\]|\\[\s\S])*")\)/)?.[1];
  if (!json) throw new Error('Données SeLoger absentes : enregistrer la page complète après son chargement.');
  const state = JSON.parse(JSON.parse(json));
  const classified = state.app_cldp?.data?.classified;
  if (!classified?.sections || !classified?.id) throw new Error('Ce fichier ne contient pas une fiche de bien.');
  return classified;
}

export function normalizeClassified(item, source, previous) {
  if (item.brand !== 'seloger' || item.contactSections?.provider?.profileUrl !== agencyUrl) throw new Error('Annonce ne provenant pas de Lamirault Immobilier.');
  if (item.metadata?.status?.status !== true) throw new Error('Annonce retirée ou statut non vérifié : import interrompu.');
  const s = item.sections;
  if (s.price?.base?.type !== 'SALE') throw new Error('Seuls les biens à vendre sont importés.');
  const reference = s.key?.keys?.find(k => k.label === 'Référence annonce')?.value || item.id;
  const type = s.hardFacts.shortTitle;
  const address = s.location.address;
  const facts = s.hardFacts.facts || [];
  const fact = key => number(facts.find(f => f.type === key)?.splitValue);
  const title = s.description?.headline || s.hardFacts.title;
  const description = s.description?.description || s.mainDescription?.description;
  const price = number(s.price.base.main.value.main.ariaLabel || s.price.base.main.value.main.value);
  if (!description || !price || !address.city) throw new Error('Description, prix ou commune manquants.');
  const localSlug = `${slugify(type)}-${slugify(address.city)}-${slugify(reference)}`;
  const priceGroup = s.price.breakdown?.groups?.[0];
  const details = priceGroup?.items?.map(p => ({label: [p.label.main, p.label.alt].filter(Boolean).join(' '), value:p.value.main.value})) || [];
  const categories = s.features?.details?.categories || (s.features?.preview?.length ? [{title:'Informations générales', elements:s.features.preview}] : []);
  const certificate = s.energy?.certificates?.[0];
  const photos = (item.domains?.medias?.images || []).map((p,i) => ({
    sourceId:p.id, sourceUrl:p.url, src:previous?.photos?.find(old=>old.sourceId===p.id)?.src || `/assets/biens/${localSlug}/${slugify(p.id)}.jpg`,
    alt: `${p.description || `Photo ${i+1}`} — ${type.toLowerCase()} à ${address.city}`,
  }));
  if (!photos.length) throw new Error('Aucune photo disponible.');
  return {
    id:item.id, reference:String(reference), slug:previous?.slug || localSlug, status:previous?.status || 'active',
    source, sourceAgency:agencyUrl, sourceUpdatedAt:item.metadata.updateDate,
    importedAt:new Date().toISOString(), title, type, city:address.city, postalCode:address.zipCode, district:address.district || '',
    price, priceLabel:s.price.base.main.value.main.value, priceDetails:details,
    feeNote:s.price.breakdown?.message?.value || s.price.components?.[0]?.units?.[0]?.main?.message?.value || '',
    livingArea:fact('livingSpace'), overallArea:fact('overallSpace'), plotArea:fact('plotSpace'), rooms:fact('numberOfRooms'), bedrooms:fact('numberOfBedrooms'),
    description, features:categories.map(c => ({title:c.title, values:c.elements.map(e => e.value)})),
    energy:{features:s.energy?.features || [], scales:(certificate?.scales || []).map(c => ({name:c.name, rating:c.efficiencyClass?.rating || null, values:c.values || []})), notes:(certificate?.features || []).filter(f=>f.type!=='minMaxEstimation').map(f=>f.label && f.label!==f.type?`${f.label} : ${f.value}`:f.value).filter(Boolean)},
    contactName:item.contactSections.provider?.contactCard?.title?.replace(/^M\.\s*/, '') || 'Lamirault Immobilier',
    photos,
  };
}

async function filesIn(input) {
  const stat = await fs.stat(input);
  if (!stat.isDirectory()) return [input];
  return (await fs.readdir(input,{withFileTypes:true})).filter(e => e.isFile() && /\.html?$/i.test(e.name)).map(e=>path.join(input,e.name));
}

export async function importFiles(inputs, {download=true}={}) {
  await fs.mkdir(path.join(root,'data/biens'),{recursive:true});
  const inventory=await fs.readFile(path.join(root,'data/seloger-inventory.json'),'utf8').then(JSON.parse).catch(()=>({urls:[]}));
  let success=0, failed=0;
  const files=(await Promise.all(inputs.map(filesIn))).flat();
  for(const input of files) {
    try {
      const html=await fs.readFile(input,'utf8');
      const c=extractClassified(html);
      if (!/^[a-zA-Z0-9]+$/.test(c.id)) throw new Error('Identifiant non valide');
      const destination=path.join(root,'data/biens',`${c.id}.json`);
      const old=await fs.readFile(destination,'utf8').then(JSON.parse).catch(()=>null);
      const canonical=html.match(/<link\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i)?.[1];
      const sidecar=await fs.readFile(input.replace(/\.html?$/i,'.url'),'utf8').then(s=>s.trim()).catch(()=>null);
      const source=canonical || sidecar || c.seo?.headInfo?.canonical || old?.source || inventory.urls.find(u=>u.endsWith('/'+c.id));
      if (!source || new URL(source).protocol !== 'https:' || new URL(source).hostname !== 'www.seloger.com' || new URL(source).pathname.split('/').pop()!==c.id) throw new Error('URL absente ou inattendue : ajouter un fichier .url contenant le lien de cette annonce');
      const data=normalizeClassified(c,source,old);
      // A changed photo is replaced; unchanged photos remain on disk.
      for (const photo of data.photos) {
        const target=path.join(root,photo.src);
        const previous=old?.photos.find(p=>p.sourceId===photo.sourceId && p.sourceUrl===photo.sourceUrl);
        if(previous && await fs.stat(target).then(()=>true).catch(()=>false)) continue;
        if (!download) continue;
        const url=new URL(photo.sourceUrl);
        if(url.protocol!=='https:' || url.hostname!=='mms.seloger.com') throw new Error('Hôte de photo inattendu');
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
        if(!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Photo indisponible : ${response.status}`);
        const bytes=Buffer.from(await response.arrayBuffer());
        await fs.mkdir(path.dirname(target),{recursive:true});
        await fs.writeFile(`${target}.tmp`,bytes);
        await fs.rename(`${target}.tmp`,target);
      }
      data.contentHash=createHash('sha256').update(JSON.stringify({...data,importedAt:undefined})).digest('hex');
      // Keep a stable file when neither source data nor images changed.
      if(old?.contentHash!==data.contentHash) {
        await fs.writeFile(`${destination}.tmp`,JSON.stringify(data,null,2)+'\n');
        await fs.rename(`${destination}.tmp`,destination);
      }
      console.log(`OK ${data.reference} · ${data.type} · ${data.city} · ${data.priceLabel} · ${data.photos.length} photos`);
      success++;
    }catch(error){console.error(`ÉCHEC ${path.basename(input)} : ${error.message}`);failed++;}
  }
  console.log(`${success} fiche(s) importée(s), ${failed} échec(s). Aucune fiche existante supprimée.`);
  if(failed) process.exitCode=1;
  return {success,failed};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const inputs=process.argv.slice(2).filter(a=>a!=='--no-download');
 if(!inputs.length){console.error('Usage : npm run biens:import -- /chemin/annonce.html [autre.html ou dossier]');process.exitCode=1;}
 else await importFiles(inputs,{download:!process.argv.includes('--no-download')});
}
