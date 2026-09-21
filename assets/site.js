
let PRODUCTS=[];
let CART=JSON.parse(localStorage.getItem('lp_cart')||'[]');
let currentProduct=null,currentVariant=0;

const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0});
const saveCart=()=>{localStorage.setItem('lp_cart',JSON.stringify(CART));renderCartCount()};
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function loadProducts(){
 const r=await fetch('assets/products.json'); PRODUCTS=await r.json();
 if(document.body.dataset.page==='shop') initShop();
 if(document.body.dataset.page==='product') initProduct();
 renderCartCount(); renderCart();
}
function imageOf(p,i=0){return p.images?.[i]||p.images?.[0]||'https://placehold.co/700x700/f3f0e7/173340?text=Vowshot'}
function minVar(p){return p.variants.reduce((a,b)=>b.price<a.price?b:a,p.variants[0])}
function maxVar(p){return p.variants.reduce((a,b)=>b.price>a.price?b:a,p.variants[0])}
function discount(v){return v.compare>v.price?Math.round((1-v.price/v.compare)*100):0}
function card(p){
 const v=minVar(p), d=discount(v);
 return `<article class="product">
 <div class="p-img"><a href="product.html?handle=${encodeURIComponent(p.handle)}"><img loading="lazy" src="${imageOf(p)}" alt="${esc(p.title)}"></a>${d?`<span class="badge">${d}% OFF</span>`:''}<button class="wish" onclick="event.preventDefault();this.textContent=this.textContent==='♡'?'♥':'♡'">♡</button></div>
 <div class="p-body"><div class="vendor">${esc(p.vendor||'Vowshot')}</div><a href="product.html?handle=${encodeURIComponent(p.handle)}" class="p-title">${esc(p.title)}</a><p class="p-desc">${esc(String(p.body||'Premium personalized Vowshot product.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).slice(0,95)}${String(p.body||'').replace(/<[^>]*>/g,' ').trim().length>95?'…':''}</p>
 <div><span class="price">${money(v.price)}</span>${v.compare?`<span class="compare">${money(v.compare)}</span>`:''}${d?`<span class="save">${d}% off</span>`:''}</div>
 <div class="stars">★★★★★ <span style="color:#899">4.8</span></div>
 <div class="p-foot"><a class="btn" href="product.html?handle=${encodeURIComponent(p.handle)}">View</a><button class="btn add" onclick="quickAdd('${p.handle}')">Add to Cart</button><button class="btn buy" onclick="buyCard('${p.handle}')">Buy Now</button></div></div></article>`;
}
function buyCard(handle){const p=PRODUCTS.find(x=>x.handle===handle);if(!p)return;location.href='checkout.html?buy='+encodeURIComponent(p.handle)+'&variant=0&qty=1'}
function quickAdd(handle){const p=PRODUCTS.find(x=>x.handle===handle);if(!p)return;addToCart(p,0,1)}
function addToCart(p,vi=0,qty=1){const v=p.variants[vi]||p.variants[0];const key=p.handle+'|'+vi;let item=CART.find(x=>x.key===key);if(item)item.qty+=qty;else CART.push({key,handle:p.handle,title:p.title,img:imageOf(p),price:v.price,options:v.options,qty});saveCart();openCart()}
function renderCartCount(){document.querySelectorAll('[data-cart-count]').forEach(x=>x.textContent=CART.reduce((s,i)=>s+i.qty,0))}
function renderCart(){
 const box=document.querySelector('[data-cart-body]'); if(!box)return;
 if(!CART.length){box.innerHTML='<div style="padding:40px 10px;text-align:center;color:#778">Your cart is empty.<br><br><a class="btn gold" href="shop.html">Continue Shopping</a></div>';return}
 box.innerHTML=CART.map((i,n)=>`<div class="cart-item"><img src="${i.img}"><div><b style="font-size:12px">${esc(i.title)}</b><div style="font-size:10px;color:#778">${esc(i.options.join(' / '))}</div><div>${money(i.price)} × ${i.qty}</div><button class="btn" style="padding:5px 8px;margin-top:6px" onclick="removeCart(${n})">Remove</button></div><strong>${money(i.price*i.qty)}</strong></div>`).join('');
 const total=CART.reduce((s,i)=>s+i.price*i.qty,0);
 document.querySelector('[data-cart-total]').textContent=money(total);
 const checkout=document.querySelector('[data-checkout-link]'); if(checkout) checkout.href='checkout.html';
}
function removeCart(i){CART.splice(i,1);saveCart();renderCart()}
function openCart(){document.querySelector('.drawer')?.classList.add('open');document.querySelector('.overlay')?.classList.add('show');renderCart()}
function closeCart(){document.querySelector('.drawer')?.classList.remove('open');document.querySelector('.overlay')?.classList.remove('show')}

function initShop(){
 const grid=document.querySelector('[data-products]'), count=document.querySelector('[data-result]');
 const search=document.querySelector('[data-search]');
 const catLinks=[...document.querySelectorAll('[data-cat]')];
 const urlCat=new URLSearchParams(location.search).get('cat'); let state={q:'',cat:urlCat||'All',sort:'featured'};
 function render(){
  let arr=PRODUCTS.filter(p=>(state.cat==='All'||p.category===state.cat)&&(!state.q||(p.title+' '+p.category).toLowerCase().includes(state.q.toLowerCase())));
  if(state.sort==='low')arr.sort((a,b)=>minVar(a).price-minVar(b).price);
  if(state.sort==='high')arr.sort((a,b)=>minVar(b).price-minVar(a).price);
  if(state.sort==='name')arr.sort((a,b)=>a.title.localeCompare(b.title));
  grid.innerHTML=arr.map(card).join('');count.textContent=`${arr.length} products`;
 }
 search?.addEventListener('input',e=>{state.q=e.target.value;render()});
 document.querySelector('[data-sort]')?.addEventListener('change',e=>{state.sort=e.target.value;render()});
 catLinks.forEach(x=>x.addEventListener('click',()=>{state.cat=x.dataset.cat;catLinks.forEach(y=>y.classList.toggle('active',y.dataset.cat===state.cat));render()}));
 render();
}
function initProduct(){
 const handle=new URLSearchParams(location.search).get('handle');currentProduct=PRODUCTS.find(p=>p.handle===handle)||PRODUCTS[0];
 if(!currentProduct)return;
 renderProduct();
}
function renderProduct(){
 const p=currentProduct,v=p.variants[currentVariant]||p.variants[0];
 document.title=p.title+' | Vowshot';
 const root=document.querySelector('[data-product-root]');
 const optionNames=[];
 const sourceRows=p.variants;
 // Build option groups by position, preserving names from common product patterns.
 let names=[];
 if(p.category==='Photography Packages') names=['Package / Option'];
 else if(p.handle.includes('silk-4-in-1')) names=['Size','Color'];
 else names=['Select Variant'];
 let optionsHtml='';
 if(p.variants.length>1){
  const sets=[];
  const max=p.variants.reduce((m,x)=>Math.max(m,x.options.length),0);
  for(let pos=0;pos<max;pos++){
   const vals=[...new Set(p.variants.map(x=>x.options[pos]).filter(Boolean))];
   sets.push(`<div class="option"><b>${max>1?(pos===0?'Size':'Color'):'Choose an option'}</b><div class="chips">${vals.map(val=>{
    const idx=p.variants.findIndex(x=>x.options[pos]===val && x.options.slice(0,pos).every((z,j)=>z===v.options[j]));
    return `<button class="chip ${v.options[pos]===val?'active':''}" onclick="selectVariant(${idx})">${esc(val)}</button>`;
   }).join('')}</div></div>`);
  }
  optionsHtml=sets.join('');
 }
 const d=discount(v);
 root.innerHTML=`<div class="gallery"><div class="thumbs">${p.images.map((im,i)=>`<div class="thumb ${i===0?'active':''}" onclick="setMainImage('${im}',this)"><img src="${im}" alt=""></div>`).join('')}</div><div class="main-img"><img data-main src="${imageOf(p)}" alt="${esc(p.title)}"></div></div>
 <div class="detail"><div class="vendor">${esc(p.vendor||'Vowshot')}</div><h1>${esc(p.title)}</h1><div><span class="detail-price">${money(v.price)}</span>${v.compare?`<span class="mrp">${money(v.compare)}</span>`:''}${d?`<span class="discount">${d}% OFF</span>`:''}</div><div class="stars" style="margin-top:8px">★★★★★ <span style="color:#7b8588">4.8 • 100+ reviews</span></div>
 ${optionsHtml}<div class="option"><b>Quantity</b><div class="chips"><button class="chip" onclick="qtyChange(-1)">−</button><span class="chip" id="qty">1</span><button class="chip" onclick="qtyChange(1)">+</button></div></div>
 <div class="detail-actions"><button class="btn" onclick="addCurrent()">Add to Cart</button><button class="btn gold" onclick="buyCurrent()">Buy Now</button></div>
 <div class="desc"><h3 style="color:#f8f7f2;margin:0 0 10px;font-size:18px">Product Description</h3>${p.body||'<p>Premium Vowshot product crafted for your memories.</p>'}<div class="value-pills" style="margin-top:18px"><span>✓ Premium finishing</span><span>✓ Secure packaging</span><span>✓ Personalization support</span></div></div></div>`;
}
function setMainImage(src,el){document.querySelector('[data-main]').src=src;document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function selectVariant(i){if(i>=0){currentVariant=i;renderProduct()}}
let qty=1;function qtyChange(n){qty=Math.max(1,qty+n);const e=document.getElementById('qty');if(e)e.textContent=qty}
function addCurrent(){addToCart(currentProduct,currentVariant,qty);qty=1}
function buyCurrent(){const v=currentProduct.variants[currentVariant]||currentProduct.variants[0];location.href='checkout.html?buy='+encodeURIComponent(currentProduct.handle)+'&variant='+currentVariant+'&qty='+qty}
function mobileMenu(){const m=document.querySelector('.menu');if(!m)return;m.classList.toggle('open');}
document.addEventListener('click',e=>{if(e.target.closest('.menu a'))document.querySelector('.menu')?.classList.remove('open')});

document.addEventListener('DOMContentLoaded',async()=>{document.querySelectorAll('[data-open-cart]').forEach(x=>x.onclick=openCart);document.querySelectorAll('[data-close-cart]').forEach(x=>x.onclick=closeCart);document.querySelector('.overlay')?.addEventListener('click',closeCart);await loadProducts();if(document.body.dataset.page==='home'){const el=document.querySelector('[data-home-products]');if(el){el.innerHTML=PRODUCTS.filter(p=>p.category!=='Photography Packages').slice(0,8).map(card).join('')}}if(document.body.dataset.page==='product'){const r=document.querySelector('[data-related]');if(r&&currentProduct)r.innerHTML=PRODUCTS.filter(p=>p.category===currentProduct.category&&p.handle!==currentProduct.handle).slice(0,4).map(card).join('')}});

/* V13 marketplace rendering enhancements */
const _v13Card = card;
card = function(p){
  return _v13Card(p).replace('<article class="product">','<article class="product lp-product-card">');
};
