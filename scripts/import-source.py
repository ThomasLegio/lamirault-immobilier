"""Import the captured, public source into editable local page fragments.

Usage: python3 scripts/import-source.py /path/to/lamirault-source
Requires beautifulsoup4. Runtime and build have no third-party dependencies.
"""
import sys, json, re, shutil, html
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
SOURCE=Path(sys.argv[1])
BASE='https://www.lamiraultimmobilier.fr/'
manifest=json.loads((SOURCE/'asset-manifest.json').read_text())
failures=json.loads((SOURCE/'asset-failures.json').read_text())
for folder in ['content','assets/source','data','demande-estimation']:
 (ROOT/folder).mkdir(parents=True,exist_ok=True)
for f in (SOURCE/'assets').iterdir():
 if f.is_file() and not f.name.endswith('.original'):shutil.copy2(f,ROOT/'assets/source'/f.name)

def local_url(value,base=BASE):
 if not value or value.startswith(('data:','#','mailto:','tel:')):return value
 url=urljoin(base,value)
 if url in manifest:return '/assets/source/'+Path(manifest[url]).name
 if url in failures:return 'data:,'
 if urlsplit(url).netloc in ['www.lamiraultimmobilier.fr','lamiraultimmobilier.fr']:
  parts=urlsplit(url);return parts.path+('?' + parts.query if parts.query else '')+('#'+parts.fragment if parts.fragment else '')
 return value

def local_css(text):
 def replace(m):
  value=m.group(1).strip(' \"\'')
  return 'url("'+local_url(value)+'")'
 return re.sub(r'url\(([^)]+)\)',replace,text)

def clean(s):
 for x in list(s.select('script,noscript')):x.decompose()
 for x in s.find_all(True):
  for attr in list(x.attrs):
   if attr.lower().startswith('on') or attr in ['data-widget-config','data-binding','data-anim-extended'] or attr.startswith('data-animation'):del x[attr]
  if x.has_attr('style'):x['style']=local_css(x['style'])
  for attr in ['href','src','poster','data-src','data-dm-image-path','xlink:href']:
   if x.has_attr(attr):x[attr]=local_url(x[attr])
  if x.name=='img':
   if x.get('data-src') and (not x.get('src') or x['src'].startswith('data:')):x['src']=x['data-src']
   if x.get('src'):x['loading']='lazy';x['decoding']='async'
   for a in ['srcset','data-srcset','onerror']:x.attrs.pop(a,None)
  if x.name=='svg' and 'viewbox' in x.attrs:x['viewBox']=x.attrs.pop('viewbox')
  if x.name=='a' and x.get('target')=='_blank':x['rel']='noopener noreferrer'
  if x.name=='a' and x.get('href','').startswith('javascript:'):x.attrs.pop('href',None)
 for x in s.select('style'):x.string=local_css(x.get_text())
 return s

news=json.loads((SOURCE/'news-feed.json').read_text())['data']
reviews=json.loads((SOURCE/'reviews.json').read_text())['values']
for item in news:
 for photo in item.get('photos',[]):
  for key in ['url','thumbnail']:photo[key]=local_url(photo.get(key,''))
(ROOT/'data/news.json').write_text(json.dumps(news,ensure_ascii=False,indent=2))
(ROOT/'data/reviews.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2))

def news_card(item,i,full=False):
 date=item['publish_at'][:10];date='/'.join(reversed(date.split('-')))
 text=item.get('content','');excerpt=text if len(text)<550 else text[:550]+'…'
 photos=item.get('photos',[]);image=''
 if photos:image=f'<a href="/actualite/?id={i}"><img class="Solocal_news_photo Solocal_shrinker" src="{photos[0]["url"]}" alt="Actualité Lamirault Immobilier du {date}" loading="lazy"></a>'
 def para(t):return html.escape(t).replace('\n','<br>')
 return f'''<article class="Solocal_news_card card1" data-news-id="{i}"><ul><li class="photoContainer"><div class="Solocal_gallery"><div class="Solocal_gallery_item active">{image}</div></div></li><li class="titleContainer"><h3 class="cardTitle">Actualité</h3><p class="cardDate">Publié le {date}</p><p class="cardContent li-news-excerpt">{para(excerpt)}</p><div class="cardContent li-news-full" hidden>{para(text)}</div><p class="cardReadMore"><a href="/actualite/?id={i}">Lire la suite</a></p></li></ul></article>'''

def reviews_html():
 cards=[]
 for i,item in enumerate(reviews):
  d=item['data'];text=html.escape(d.get('Text','')).replace('&lt;br&gt;','<br>');reply=html.escape(d.get('ReplyContent','')).replace('&lt;br&gt;','<br>')
  date=d.get('CreatedAt','')[:10];formatted='/'.join(reversed(date.split('-')))
  reply_html=f'<div class="reply"><p class="reply-title">Réponse de l’établissement</p><p>{reply}</p></div>' if reply else ''
  logo=local_url(d.get('Logo Publisher hors flux',''))
  cards.append(f'''<li data-review="{i}" data-date="{date}" data-stars="{d['Stars']}"><article class="review"><div class="review-header"><div class="review-author-stars"><div class="review-author"><img class="logo" src="{logo}" alt="Google"><span class="author">{html.escape(d['AuthorName'])}</span></div><span class="stars" aria-label="{d['Stars']} sur 5">{'★'*d['Stars']}</span></div><time datetime="{date}">{formatted}</time></div><div class="review-content"><p class="comment">{text}</p>{reply_html}<a href="{html.escape(d['Url'])}" target="_blank" rel="noopener noreferrer">Voir l’avis sur Google</a></div></article></li>''')
 return '''<div class="review-container" data-reviews><div class="li-review-control"><strong>32 avis · 5/5 sur Google</strong><label>Trier par : <select aria-label="Trier les avis"><option value="CreatedAt-desc">Avis les plus récents</option><option value="Stars-desc">Notes les plus favorables</option><option value="Stars-asc">Notes les moins favorables</option></select></label></div><ul class="data-list">'''+''.join(cards)+'''</ul><nav class="li-pagination" aria-label="Pages des avis"></nav></div>'''

pages=[]
for file in sorted(SOURCE.glob('lamirault-*.html')):
 route=file.stem.removeprefix('lamirault-');s=BeautifulSoup(file.read_text(),'html.parser')
 first=s.select_one('#dmFirstContainer')
 if first is None:continue
 captured_path=SOURCE/'captures'/f'{route}-1440-clean.html'
 captured=BeautifulSoup(captured_path.read_text(),'html.parser') if captured_path.exists() else s
 for widget in list(first.select('[data-element-type=custom_extension]')):
  rendered=captured.find(id=widget.get('id'))
  if rendered:widget.replace_with(BeautifulSoup(str(rendered),'html.parser'))
 if route in ['actualite','home']:
  widget=first.select_one('[data-widget-id="77558392bbcd40a6975a6376fd3a0248"]')
  if widget:
   widget.clear()
   value=('<div class="proliveContainer dmNewParagraph"><div data-news-list>'+''.join(news_card(n,i) for i,n in enumerate(news))+'</div></div>') if route=='actualite' else '<div class="proliveContainer dmNewParagraph">'+news_card(news[0],0)+'<p style="text-align:right"><a href="/actualite/">Voir toutes les actualités</a></p></div>'
   widget.append(BeautifulSoup(value,'html.parser'))
 if route=='page-avis':
  widget=first.select_one('[data-element-type=custom_extension]');widget.clear();widget.append(BeautifulSoup(reviews_html(),'html.parser'))
 if route=='privacy':
  widget=first.select_one('[data-element-type=custom_extension]');widget.clear()
  widget.append(BeautifulSoup('<div class="bg-widget-422469"><h2>Les cookies sur ce site</h2><p>Cette version du site ne dépose aucun cookie publicitaire et ne charge aucun outil de mesure d’audience.</p><p>Les liens vers Google, SeLoger et nos réseaux sociaux ouvrent des sites externes, qui disposent de leurs propres politiques de confidentialité.</p><p>Le formulaire de demande d’estimation utilise le service de recherche de communes et transmet votre demande uniquement lorsque vous la validez.</p><p>Pour toute question : <a href="mailto:contact@lamiraultimmobilier.fr">contact@lamiraultimmobilier.fr</a>.</p><p><a href="/vie-privee/">Consulter la politique de confidentialité</a></p></div>','html.parser'))
 for form in first.select('form'):
  form['data-contact-form']=route;form.attrs.pop('action',None);form.attrs.pop('method',None)
  for hidden in list(form.select('input[type=hidden]')):hidden.decompose()
  for field in form.select('.required input,.required select,.required textarea'):
   if field.get('type') not in ['submit','hidden']:field['required']='';field['maxlength']='2000' if field.name=='textarea' else '254'
  for field in form.select('input[type=email]'):field['autocomplete']='email'
  for field in form.select('input[type=tel]'):field['autocomplete']='tel'
  for upload in form.select('.filewrapper'):
   upload.clear();upload.append('Joignez votre CV à l’e-mail de candidature qui s’ouvrira après validation.')
  submit=form.select_one('input[type=submit]')
  if submit:submit['value']='Préparer mon e-mail'
  consent=BeautifulSoup('<label class="li-form-consent"><input type="checkbox" required name="consent">J’accepte d’être recontacté dans le cadre de ma demande. <a href="/vie-privee/">Vie privée</a></label>','html.parser')
  if submit:submit.parent.insert_before(consent)
  note=BeautifulSoup('<p class="li-feedback" role="status">Ce formulaire prépare un e-mail à contact@lamiraultimmobilier.fr. Vous pourrez vérifier votre message puis l’envoyer depuis votre messagerie.</p>','html.parser');form.insert_after(note)
 if route=='estimation':
  form=first.select_one('form')
  if form:form.parent.insert_before(BeautifulSoup('<div class="li-inline-cta"><a class="li-button" href="/demande-estimation/">Commencer mon estimation en ligne</a></div>','html.parser'))
 for dead in first.select('.dmform-success,.dmform-error,.dmform-error-message'):dead.decompose()
 for map_widget in first.select('[data-element-type=dMapId]'):
  map_widget.clear();map_widget.append(BeautifulSoup('<a class="li-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=25+all%C3%A9e+du+B%C3%A9tin+86170+Neuville-de-Poitou" target="_blank" rel="noopener noreferrer">Voir l’itinéraire vers notre agence</a>','html.parser'))
 ancestors=[];p=first.parent
 while p and p.name!='body':
  ancestors.append(p)
  if p.get('id')=='dm':break
  p=p.parent
 content=clean(BeautifulSoup(str(first),'html.parser'))
 for ancestor in ancestors:
  shell=BeautifulSoup('','html.parser');tag=shell.new_tag(ancestor.name,attrs=dict(ancestor.attrs))
  if tag.get('class'):tag['class']=[c for c in tag['class'] if c not in ['hasAnimations','hasStickyHeader','inMiniHeaderMode']]
  tag.append(content);shell.append(tag);content=shell
 (ROOT/'content'/f'{route}.html').write_text(str(content))
 css=[];links=[]
 for style in s.select('style'):
  if style.get('id') not in ['hideAnimFix']:
   rule=local_css(style.get_text())
   if style.get('media'):rule='@media '+style['media']+'{'+rule+'}'
   css.append(rule)
 (ROOT/'assets/source'/f'inline-{route}.css').write_text('\n'.join(css))
 for link in s.select('link'):
  if link.get('rel')==['stylesheet'] or link.get('as')=='style':
   url=local_url(link['href'])
   if url.startswith('/assets/'):links.append(url)
 head='\n'.join(f'<link rel="stylesheet" href="{x}">' for x in links)+f'\n<link rel="stylesheet" href="/assets/source/inline-{route}.css">'
 pages.append({'route':'' if route=='home' else route,'alias':route,'title':s.title.get_text(),'description':s.select_one('meta[name=description]').get('content','') if s.select_one('meta[name=description]') else '', 'head':head,'content':f'{route}.html','bodyClass':'dmRoot fix-mobile-scrolling flex-site dmResellerSite runtime-module-container'})

# Preserve the existing estimation funnel, including its original backend contract.
saved=ROOT/'content/estimate-original.html'
if not saved.exists():saved.write_text((ROOT/'index.html').read_text())
estimate=BeautifulSoup(saved.read_text(),'html.parser')
main=estimate.select_one('main');aside=estimate.select_one('.sticky-cta')
for img in main.select('img[src]'):img['src']='/'+img['src'].lstrip('/')
text=str(main)+(str(aside) if aside else '')
text=text.replace('Estimez gratuitetment mon bien !','Faites estimer gratuitement votre bien')
(ROOT/'content/demande-estimation.html').write_text(text)
pages.append({'route':'demande-estimation','alias':'demande-estimation','title':'Estimation immobilière gratuite | Lamirault Immobilier','description':'Demandez une estimation gratuite de votre bien à Poitiers et dans la Vienne.','head':'<link rel="stylesheet" href="/styles.css">','content':'demande-estimation.html','bodyClass':'estimate-page','script':'/script.js'})
(ROOT/'content/pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2))
(ROOT/'data/source-inventory.json').write_text(json.dumps({'source':BASE,'capturedAt':'2026-09-29','pages':[x['route'] or '/' for x in pages],'newsCount':len(news),'reviewCount':len(reviews),'externalListings':'https://www.seloger.com/professionnels/agences-immobilieres/neuville-de-poitou-86170/agence-645351/'},ensure_ascii=False,indent=2))
print(f'Imported {len(pages)} pages, {len(news)} news items and {len(reviews)} reviews.')
