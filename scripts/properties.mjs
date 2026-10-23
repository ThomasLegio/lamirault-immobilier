import fs from 'node:fs/promises';
import path from 'node:path';

export const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const e = escapeHtml;
const number = value => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);
const money = value => `${number(value)} €`;
export const category = p => p.type.startsWith('Terrain') ? 'Terrain' : p.type.startsWith('Maison') ? 'Maison' : p.type;
const area = p => p.livingArea || p.overallArea ? `${number(p.livingArea || p.overallArea)} m²` : p.plotArea ? `${number(p.plotArea)} m² de terrain` : 'Surface non renseignée';
const rows = entries => entries.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('');
const stats = p => [p.livingArea && ['Surface habitable',`${number(p.livingArea)} m²`],p.overallArea && ['Surface totale',`${number(p.overallArea)} m²`],p.rooms && ['Pièces',number(p.rooms)],p.bedrooms && ['Chambres',number(p.bedrooms)],p.plotArea && ['Terrain',`${number(p.plotArea)} m²`]].filter(Boolean);
const colors = ['#63b784','#a3cc79','#dae477','#f5e272','#efbd77','#e99583','#d97c88'];
const gesColors = ['#d8e9f1','#b6d4e6','#a4bfda','#9ca9cc','#9690bb','#8879a7','#786594'];

export async function loadProperties(root) {
  const dir=path.join(root,'data/biens');
  const names=(await fs.readdir(dir)).filter(name=>name.endsWith('.json'));
  const properties=await Promise.all(names.map(async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'))));
  const slugs=new Set();
  for(const p of properties){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || slugs.has(p.slug)) throw new Error(`Slug de bien invalide ou dupliqué : ${p.slug}`);
    slugs.add(p.slug);
    if(!['active','archived'].includes(p.status)) throw new Error(`Statut invalide : ${p.id}`);
    if(!p.title || !p.city || !p.description || !(p.price>0) || !p.photos?.length) throw new Error(`Fiche incomplète : ${p.id}`);
    if(!(p.livingArea>0 || p.overallArea>0 || p.plotArea>0)) throw new Error(`Surface manquante : ${p.id}`);
    for(const photo of p.photos){
      if(!/^\/assets\/biens\/[a-z0-9-]+\/[a-z0-9.-]+$/.test(photo.src)) throw new Error(`Chemin photo invalide : ${p.id}`);
      await fs.access(path.join(root,photo.src));
    }
  }
  const inventory=JSON.parse(await fs.readFile(path.join(root,'data/seloger-inventory.json'),'utf8'));
  return properties.sort((a,b)=>{
    const ai=inventory.urls.indexOf(a.source),bi=inventory.urls.indexOf(b.source);
    return (ai<0?999:ai)-(bi<0?999:bi) || a.city.localeCompare(b.city,'fr');
  });
}

function energyBlock(p){
  if(!p.energy.scales.length && category(p)==='Terrain') return '';
  return `<section class="property-section" aria-labelledby="energy-title"><h2 id="energy-title">Performance énergétique</h2>${p.energy.scales.length?`<div class="property-energy-grid">${p.energy.scales.map((scale,i)=>`<div class="property-energy"><h3>${e(scale.name)}</h3>${/^[A-G]$/.test(scale.rating)?`<div class="property-energy-scale" aria-hidden="true">${[...'ABCDEFG'].map((letter,j)=>`<span style="--energy-color:${(i===0?colors:gesColors)[j]}" aria-current="${letter===scale.rating}">${letter}</span>`).join('')}</div><p class="property-energy-value">Classe ${e(scale.rating)}</p>`:'<p class="property-note">Classe non renseignée dans l’annonce.</p>'}${scale.values.map(v=>`<p class="property-note">${e(v.label)} : <strong>${e(v.value)}</strong></p>`).join('')}</div>`).join('')}</div>`:'<p>Diagnostic non renseigné dans l’annonce.</p>'}${p.energy.notes.map(note=>`<p class="property-note">${e(note)}</p>`).join('')}</section>`;
}

export function renderProperty(p) {
  const photos=p.photos;
  // Retain the selected photographs of the original Saint-Benoît page.
  const indices=p.id==='265U6QSAMBT5' && photos.length>3 ? [0,2,3] : photos.slice(0,3).map((_,i)=>i);
  const gallery=indices.map((index,position)=>{const photo=photos[index];return `<a class="property-photo" href="${e(photo.src)}" data-gallery-open="${index}" aria-label="Agrandir la photo : ${e(photo.alt)}"><img src="${e(photo.src)}" alt="${e(photo.alt)}" width="1440" height="1080" ${position===0?'fetchpriority="high"':'loading="lazy"'}>${position===indices.length-1?`<span class="property-photo-count">Voir ${photos.length===1?'la photo':`les ${photos.length} photos`} ↗</span>`:''}</a>`;}).join('');
  const subject=`Demande de visite — ${p.type} à ${p.city} — Réf. ${p.reference}`;
  const mail=`mailto:contact@lamiraultimmobilier.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Bonjour,\n\nJe souhaite obtenir des renseignements et organiser une visite pour le bien à ${p.city}, référence ${p.reference}, proposé à ${money(p.price)}.\n\nMes coordonnées :\nNom :\nTéléphone :\nDisponibilités :\n\nMerci.`)}`;
  const priceDetails=[['Prix de vente',money(p.price)],...p.priceDetails.map(d=>[d.label,d.value])];
  return `<main class="property-wrap">
  
  ${p.status==='archived'?'<p class="property-archive">Ce bien n’est plus proposé à la vente. <a href="/biens/">Découvrir nos biens disponibles</a>.</p>':''}
  <header class="property-heading"><div><p class="property-eyebrow"><span class="property-status">${p.status==='active'?'À vendre':'Annonce archivée'}</span> ${e(p.type)} · Vienne</p><h1>${e(p.title)}</h1><p class="property-location">${e(p.city)} (${e(p.postalCode)})${p.district?` · ${e(p.district)}`:''}</p></div><p class="property-reference">Référence du bien : <strong>${e(p.reference)}</strong></p></header>
  <section class="property-gallery property-gallery-${indices.length}" data-property-gallery aria-label="Photos du bien">${gallery}</section>
  <div class="property-body"><div class="property-content">
    <dl class="property-stats">${rows(stats(p))}</dl>
    <section class="property-section property-description" aria-labelledby="description-title"><p class="property-eyebrow">Découvrir le bien</p><h2 id="description-title">Description du bien</h2>${p.description.split(/\n\s*\n/).map(text=>`<p>${e(text).replaceAll('\n','<br>')}</p>`).join('')}</section>
    <section class="property-section" aria-labelledby="features-title"><h2 id="features-title">Les caractéristiques</h2><dl class="property-features">${rows([['Type de bien',p.type],...stats(p),...p.energy.features.map(f=>[f.label,f.value])])}</dl><div class="property-feature-groups">${p.features.map(group=>`<div><h3>${e(group.title)}</h3><ul>${group.values.map(value=>`<li>${e(value)}</li>`).join('')}</ul></div>`).join('')}</div></section>
    ${energyBlock(p)}
    <section class="property-section" aria-labelledby="price-title"><h2 id="price-title">Le prix en détail</h2><dl class="property-features property-price-details">${rows(priceDetails)}</dl><p class="property-note">${e(p.feeNote)}. Prix hors frais de notaire.</p></section>
    <section class="property-section" aria-labelledby="location-title"><h2 id="location-title">${e(p.city)}${p.district?` · ${e(p.district)}`:''}</h2><p>Commune : ${e(p.city)} (${e(p.postalCode)}).</p><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${p.city} ${p.postalCode}`)}" target="_blank" rel="noopener noreferrer">Découvrir la commune sur la carte ↗</a><div class="property-legal"><p>Les informations sur les risques auxquels ce bien est exposé sont disponibles sur le site <a href="https://www.georisques.gouv.fr/" target="_blank" rel="noopener noreferrer">Géorisques</a>.</p></div></section>
  </div><aside class="property-contact" aria-label="Prix et contact"><p class="property-price-label">Prix de vente</p><p class="property-price">${money(p.price)}</p><p class="property-fee-note">${e(p.feeNote)}</p><div class="property-agent"><h2>Ce bien vous intéresse ?</h2><p>${e(p.contactName)} vous accompagne<br>dans votre projet immobilier.</p><a class="property-cta" href="${e(mail)}">Demander une visite <span aria-hidden="true">→</span></a><a class="property-cta property-cta-secondary" href="tel:+33586160919">05 86 16 09 19</a></div><a class="property-source" href="${e(p.source)}" target="_blank" rel="noopener noreferrer">Voir l’annonce sur SeLoger ↗</a></aside></div>
  <dialog class="property-dialog" data-property-dialog aria-label="Photos du bien à ${e(p.city)}"><div class="property-dialog-header"><p data-gallery-counter aria-live="polite">Photo 1 sur ${photos.length}</p><button type="button" data-gallery-close autofocus>Fermer ×</button></div><img class="property-dialog-image" data-gallery-image src="${e(photos[0].src)}" alt="${e(photos[0].alt)}" width="1440" height="1080" loading="lazy"><div class="property-dialog-nav"><button type="button" data-gallery-prev>← Précédente</button><button type="button" data-gallery-next>Suivante →</button></div><nav class="property-thumbnails" aria-label="Choisir une photo">${photos.map((photo,i)=>`<a href="${e(photo.src)}" data-gallery-thumbnail aria-label="Afficher la photo ${i+1}" aria-current="false"><img src="${e(photo.src)}" alt="${e(photo.alt)}" width="66" height="48" loading="lazy"></a>`).join('')}</nav></dialog>
  </main>`;
}

export function renderCatalogue(properties){
  const active=properties.filter(p=>p.status==='active');
  const cities=[...new Set(active.map(p=>p.city))].sort((a,b)=>a.localeCompare(b,'fr'));
  const types=[...new Set(active.map(category))].sort((a,b)=>a.localeCompare(b,'fr'));
  const options=items=>items.map(v=>`<option value="${e(v)}">${e(v)}</option>`).join('');
  return `<main class="property-wrap catalogue" data-catalogue><header class="catalogue-heading"><p class="property-eyebrow">Lamirault Immobilier · Poitiers & la Vienne</p><h1>Nos biens à vendre</h1><p>Une maison pour votre famille, un terrain pour construire ou un investissement pour demain. Découvrez les biens de notre agence.</p></header>
  <form class="catalogue-filters" data-catalogue-filters hidden aria-label="Filtrer les biens"><label>Commune<select name="city"><option value="">Toutes les communes</option>${options(cities)}</select></label><label>Type de bien<select name="type"><option value="">Tous les types</option>${options(types)}</select></label><label>Budget maximum<input name="budget" type="number" min="0" step="1000" inputmode="numeric" placeholder="Sans limite · €"></label><button type="reset">Réinitialiser</button></form>
  <div class="catalogue-toolbar"><p data-catalogue-count aria-live="polite" role="status">${active.length} biens à vendre</p><label data-catalogue-sort-label hidden>Trier par <select data-catalogue-sort aria-label="Trier les biens"><option value="selection">Notre sélection</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="area-desc">Surface décroissante</option></select></label></div>
  <div class="catalogue-grid" data-catalogue-grid>${active.map((p,index)=>{const rating=p.energy.scales[0]?.rating;return `<article class="property-card" data-city="${e(p.city)}" data-type="${e(category(p))}" data-price="${p.price}" data-area="${p.livingArea || p.overallArea || p.plotArea || 0}" data-order="${index}"><a class="property-card-link" href="/biens/${e(p.slug)}/"><div class="property-card-photo"><img src="${e(p.photos[0].src)}" alt="${e(p.photos[0].alt)}" width="720" height="540" loading="${index<3?'eager':'lazy'}"><span class="property-card-type">${e(p.type)}</span></div><div class="property-card-content"><p class="property-card-city">${e(p.city)} <span>${e(p.postalCode)}</span></p><h2>${e(p.title)}</h2><p class="property-card-facts">${e(area(p))}${p.rooms?` · ${number(p.rooms)} pièces`:''}${p.bedrooms?` · ${number(p.bedrooms)} ch.`:''}</p><p class="property-card-price">${money(p.price)}</p><p class="property-card-fees">${e(p.feeNote)}</p><div class="property-card-bottom"><span>${rating?`DPE <strong class="property-card-dpe" data-rating="${e(rating)}">${e(rating)}</strong>`:`Réf. ${e(p.reference)}`}</span><span>Découvrir le bien <span aria-hidden="true">↗</span></span></div></div></a></article>`;}).join('')}</div>
  <div class="catalogue-empty" data-catalogue-empty hidden><h2>Aucun bien ne correspond à votre recherche.</h2><p>Essayez une autre commune ou un budget plus large.</p><button type="button" data-catalogue-reset>Voir tous les biens</button></div>
  <section class="catalogue-help"><div><h2>Parlons de votre recherche.</h2><p>Vous n’avez pas encore trouvé votre bien ? Notre équipe vous accompagne dans votre projet.</p></div><a class="property-cta" href="/contact/">Contacter l’agence <span aria-hidden="true">→</span></a></section></main>`;
}

export function propertyPages(properties){
 return [{route:'biens',alias:'biens',breadcrumbLabel:'Nos biens',title:'Nos biens à vendre dans la Vienne | Lamirault Immobilier',description:'Découvrez les maisons, terrains et immeubles à vendre de Lamirault Immobilier à Poitiers et dans la Vienne.',head:'<link rel="stylesheet" href="/shared/property.css"><link rel="stylesheet" href="/shared/catalogue.css">',bodyClass:'property-page catalogue-page',script:'/shared/catalogue.js',html:renderCatalogue(properties)},...properties.map(p=>({route:`biens/${p.slug}`,breadcrumbLabel:`${p.type} à ${p.city} · Réf. ${p.reference}`,breadcrumbParents:[{label:'Nos biens',href:'/biens/'}],alias:`bien-${p.id}`,title:`${p.type} ${area(p)} à vendre à ${p.city} — ${money(p.price)} | Lamirault Immobilier`,description:`${p.title}. ${p.city} (${p.postalCode}) · ${area(p)} · ${money(p.price)}. Référence ${p.reference}. ${p.feeNote}.`,head:`<link rel="stylesheet" href="/shared/property.css"><meta property="og:type" content="website"><meta property="og:title" content="${e(p.title)}"><meta property="og:image" content="${e(p.photos[0].src)}">${p.status==='archived'?'<meta name="robots" content="noindex,follow">':''}`,bodyClass:'property-page',script:'/shared/property.js',html:renderProperty(p)}))];
}
