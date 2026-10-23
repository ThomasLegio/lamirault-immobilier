import {escapeHtml as e} from './properties.mjs';

// All pages use the same navigation component, including generated property pages.
export function renderBreadcrumbs(page) {
  if (!page.breadcrumbLabel) throw new Error(`Libellé du fil d’Ariane manquant : ${page.route}`);
  const items=page.route==='' ? [{label:'Accueil'}] : [
    {label:'Accueil',href:'/'},
    ...(page.breadcrumbParents || []),
    {label:page.breadcrumbLabel},
  ];
  return `<nav class="li-breadcrumb" aria-label="Fil d’Ariane"><ol>${items.map((item,index)=>`<li>${index===items.length-1?`<span aria-current="page" data-breadcrumb-current>${e(item.label)}</span>`:`<a href="${e(item.href)}">${e(item.label)}</a>`}</li>`).join('')}</ol></nav>`;
}
