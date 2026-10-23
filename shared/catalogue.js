(() => {
  const catalogue=document.querySelector('[data-catalogue]');
  if(!catalogue) return;
  const form=catalogue.querySelector('[data-catalogue-filters]');
  const grid=catalogue.querySelector('[data-catalogue-grid]');
  const cards=[...grid.children];
  const sort=catalogue.querySelector('[data-catalogue-sort]');
  const count=catalogue.querySelector('[data-catalogue-count]');
  const empty=catalogue.querySelector('[data-catalogue-empty]');
  const readUrl=()=>{
    const params=new URLSearchParams(location.search);
    for(const name of ['city','type','budget']) form.elements[name].value=params.get(name)||'';
    sort.value=params.get('sort')||'selection';
    if(!sort.value) sort.value='selection';
  };
  const update=(writeUrl=true)=>{
    const city=form.elements.city.value,type=form.elements.type.value;
    const rawBudget=form.elements.budget.value;
    const budget=rawBudget===''?Infinity:Number(rawBudget);
    let visible=0;
    const ordered=cards.slice().sort((a,b)=>{
      if(sort.value==='price-asc')return +a.dataset.price-+b.dataset.price;
      if(sort.value==='price-desc')return +b.dataset.price-+a.dataset.price;
      if(sort.value==='area-desc')return +b.dataset.area-+a.dataset.area;
      return +a.dataset.order-+b.dataset.order;
    });
    for(const card of ordered){
      card.hidden=Boolean((city&&card.dataset.city!==city)||(type&&card.dataset.type!==type)||+card.dataset.price>budget);
      if(!card.hidden)visible++;
      grid.append(card);
    }
    count.textContent=`${visible} bien${visible===1?'':'s'} à vendre`;
    empty.hidden=visible!==0;
    if(writeUrl){
      const params=new URLSearchParams(location.search);
      for(const [key,value] of Object.entries({city,type,budget:rawBudget,sort:sort.value==='selection'?'':sort.value})){
        if(value)params.set(key,value);else params.delete(key);
      }
      history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
    }
  };
  form.hidden=false;
  catalogue.querySelector('[data-catalogue-sort-label]').hidden=false;
  form.addEventListener('submit',event=>event.preventDefault());
  form.addEventListener('input',()=>update());
  form.addEventListener('change',()=>update());
  form.addEventListener('reset',()=>{sort.value='selection';queueMicrotask(()=>update());});
  sort.addEventListener('change',()=>update());
  catalogue.querySelector('[data-catalogue-reset]').addEventListener('click',()=>{form.reset();form.elements.city.focus();});
  window.addEventListener('popstate',()=>{readUrl();update(false);});
  readUrl();update(false);
})();
