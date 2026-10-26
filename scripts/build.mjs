import fs from 'node:fs/promises';
import path from 'node:path';
import { loadProperties, propertyPages, escapeHtml as esc } from './properties.mjs';
import { renderBreadcrumbs } from './breadcrumbs.mjs';
const root=path.resolve(import.meta.dirname,'..');
const dist=process.argv.includes('--dist');
const out=dist?path.join(root,'dist'):root;
const pages=[...JSON.parse(await fs.readFile(path.join(root,'content/pages.json'),'utf8')), ...propertyPages(await loadProperties(root))];
const header='<a class="li-skip" href="#main-content">Aller au contenu</a>'+await fs.readFile(path.join(root,'shared/header.html'),'utf8');
const footer=await fs.readFile(path.join(root,'shared/footer.html'),'utf8');
await fs.mkdir(out,{recursive:true});
for(const page of pages){
 const content=renderBreadcrumbs(page)+(page.html ?? await fs.readFile(path.join(root,'content',page.content),'utf8'));
 const html=`<!doctype html>\n<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><meta name="description" content="${esc(page.description)}"><meta name="theme-color" content="#003780"><link rel="icon" href="/assets/raw-7.png">${page.head}<link rel="stylesheet" href="/shared/shell.css"></head><body id="dmRoot" class="${page.bodyClass}" data-page-alias="${page.alias}"><div id="top"></div>${header}<div id="main-content" tabindex="-1">${content}</div>${footer}<script src="/shared/shell.js" defer></script>${page.script?`<script src="${page.script}" defer></script>`:''}</body></html>`;
 const complete=html.replace('</head>','<link rel="stylesheet" href="/shared/site.css"></head>').replace('</body>','<script src="/shared/site.js" defer></script></body>');
 const dir=path.join(out,page.route);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),complete);
}
if(dist){for(const item of ['assets','shared','data','styles.css','script.js'])await fs.cp(path.join(root,item),path.join(out,item),{recursive:true});}
const notFound=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page introuvable - Lamirault Immobilier</title><link rel="stylesheet" href="/shared/shell.css"><link rel="stylesheet" href="/shared/site.css"></head><body id="dmRoot"><div id="top"></div>${header}<div id="main-content" tabindex="-1">${renderBreadcrumbs({route:'404.html',breadcrumbLabel:'Page introuvable'})}<main style="max-width:900px;margin:60px auto;padding:24px;font-family:Inter,Arial,sans-serif"><h1>Cette page est introuvable.</h1><p>Retrouvez votre projet depuis notre page d’accueil.</p><a class="li-button" href="/">Retour à l’accueil</a></main></div>${footer}<script src="/shared/shell.js" defer></script></body></html>`;
await fs.writeFile(path.join(out,'404.html'),notFound);
console.log(`${pages.length} pages generated in ${dist?'dist/':'the project'}.`);
