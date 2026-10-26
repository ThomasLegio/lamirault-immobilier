document.querySelectorAll('[data-contact-form]').forEach(form=>{
 form.addEventListener('submit',event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const lines=[];
  for(const field of form.querySelectorAll('input:not([type=submit]):not([type=checkbox]),select,textarea')){
   if(!field.name)continue;const label=form.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent.trim()||field.name;
   lines.push(`${label} ${field.value.trim()}`);
  }
  const subject=form.dataset.contactForm==='nous-rejoindre'?'Candidature - Lamirault Immobilier':'Demande de contact - Lamirault Immobilier';
  if(form.dataset.contactForm==='nous-rejoindre')lines.push('\nJe joins mon CV à cet e-mail.');
  const href=`mailto:contact@lamiraultimmobilier.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n\n'))}`;
  const status=form.parentElement.querySelector('[role=status]');
  status.replaceChildren(document.createTextNode('Votre message est prêt. Finalisez son envoi dans votre messagerie. '));
  const link=document.createElement('a');link.href=href;link.textContent='Ouvrir à nouveau le message';status.append(link);
  window.location.href=href;
 });
});
const news=document.querySelector('[data-news-list]');
if(news){
 const params=new URLSearchParams(location.search);const cards=[...news.querySelectorAll('[data-news-id]')];
 const id=params.get('id');const selected=id!==null&&/^\d+$/.test(id)?cards.find(c=>c.dataset.newsId===id):null;
 if(id!==null){
  if(selected){cards.forEach(c=>c.hidden=c!==selected);news.classList.add('li-news-detail');selected.querySelector('.li-news-excerpt').hidden=true;selected.querySelector('.li-news-full').hidden=false;selected.querySelector('.cardReadMore').hidden=true;}
  else{cards.forEach(c=>c.hidden=true);const p=document.createElement('p');p.textContent='Cette actualité est introuvable.';news.append(p);}
  const breadcrumb=document.querySelector('.li-breadcrumb ol');
  const current=breadcrumb?.querySelector('[data-breadcrumb-current]');
  if(current){
   const parent=document.createElement('a');parent.href='/actualite/';parent.textContent='Actualités';current.replaceWith(parent);
   const item=document.createElement('li'),label=document.createElement('span');
   const date=selected?.querySelector('.cardDate')?.textContent.trim().replace(/^Publié le\s*/, '');
   label.textContent=selected?(date?`Actualité du ${date}`:'Actualité'):'Actualité introuvable';
   label.setAttribute('aria-current','page');label.dataset.breadcrumbCurrent='';item.append(label);breadcrumb.append(item);
  }
  const back=document.createElement('a');back.href='/actualite/';back.className='li-news-back';back.textContent='Retour à toutes les actualités';news.prepend(back);
 }else{
  const count=Math.ceil(cards.length/4);const current=Math.max(1,Math.min(count,Number.parseInt(params.get('p'),10)||1));
  cards.forEach((c,i)=>c.hidden=i<(current-1)*4||i>=current*4);
  const pages=document.createElement('nav');pages.className='li-pagination';pages.setAttribute('aria-label','Pages des actualités');
  for(let p=1;p<=count;p++){const a=document.createElement('a');a.href=`/actualite/?p=${p}`;a.textContent=String(p);if(p===current)a.setAttribute('aria-current','page');pages.append(a);}news.append(pages);
 }
}
const reviews=document.querySelector('[data-reviews]');
if(reviews){
 const cards=[...reviews.querySelectorAll('[data-review]')],list=reviews.querySelector('.data-list'),pager=reviews.querySelector('.li-pagination');let current=1;
 function render(){const sort=reviews.querySelector('select').value;cards.sort((a,b)=>sort==='Stars-asc'?Number(a.dataset.stars)-Number(b.dataset.stars):sort==='Stars-desc'?Number(b.dataset.stars)-Number(a.dataset.stars):b.dataset.date.localeCompare(a.dataset.date));cards.forEach((c,i)=>{list.append(c);c.hidden=i<(current-1)*5||i>=current*5;});pager.replaceChildren();for(let p=1;p<=Math.ceil(cards.length/5);p++){const b=document.createElement('button');b.type='button';b.textContent=String(p);b.setAttribute('aria-label',`Page ${p} des avis`);if(p===current)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{current=p;render();reviews.scrollIntoView({block:'start'});});pager.append(b);}}
 reviews.querySelector('select').addEventListener('change',()=>{current=1;render();});render();
}
document.querySelectorAll('.dmPhotoGallery a').forEach(a=>{a.removeAttribute('onclick');if(!a.getAttribute('href')||a.getAttribute('href')==='#'){a.removeAttribute('href');a.setAttribute('role','img');a.setAttribute('aria-label',a.querySelector('img')?.alt||'Partenaire de diffusion');}});
document.querySelectorAll('[data-lightbox]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();const dialog=document.createElement('dialog');dialog.className='li-lightbox';const close=document.createElement('button');close.textContent='Fermer';const img=document.createElement('img');img.src=a.href;img.alt=a.querySelector('img')?.alt||'';dialog.append(close,img);document.body.append(dialog);close.onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();}));
