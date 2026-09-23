
window.LP_BANK_OFFERS=[
 {bank:"State Bank of India",title:"Great Wedding Season SBI",main:"15% instant discount up to ₹25,000 on SBI Credit Cards",meta:["Credit Card","Min ₹10,000*","Max benefit ₹25,000"],terms:"Source offer details: valid on select products/services; minimum transaction value may apply; not valid on EMI or corporate cards; cannot be combined with other offers. Validity shown in the supplied offer screenshot: 26 Jul 2029, 11:59 pm."},
 {bank:"Bank of Baroda",title:"NO COST & LOW COST EMI SBI",main:"No Cost & Low Cost EMI on eligible bookings",meta:["9 / 12 / 18 months","Min ₹10,000","Max ₹2,50,000"],terms:"Source offer details: select cards/transactions; processing fees may apply on Low Cost EMI; full order value payable if EMI is cancelled; terms apply. The supplied offer screen shows Bank of Baroda Bank with EMI method."},
 {bank:"HDFC Bank",title:"HDFC OFFER",main:"Flat 10% discount on HDFC Credit Cards",meta:["Min ₹50,000","Max ₹5,00,000","Max cashback ₹50,000"],terms:"Source offer details: one time per user per card; RuPay network shown in the supplied screen; eligibility and bank terms apply. Validity shown: 01 Sep 2029, 11:59 pm."}
];
window.LP_COUPONS={
 LPWEDDING10:{label:"10% OFF Wedding",scope:"Wedding packages",type:"percent",value:10,max:10000,min:50000},
 LPLOVE5:{label:"5% OFF Pre-Wedding",scope:"Pre-Wedding packages",type:"percent",value:5,max:2500,min:15000},
 LPENGAGE5:{label:"5% OFF Engagement",scope:"Engagement packages",type:"percent",value:5,max:2000,min:15000},
 VOWSHOT10:{label:"10% OFF Vowshot",scope:"Products",type:"percent",value:10,max:1000,min:4999},
 WELCOME500:{label:"₹500 OFF",scope:"Products",type:"fixed",value:500,min:2999},
 FRAME500:{label:"₹500 OFF Premium Frames",scope:"Products",type:"fixed",value:500,min:4999}
};
window.lpCouponAmount=function(code,total,scope){const c=window.LP_COUPONS[String(code||'').trim().toUpperCase()];if(!c)return {ok:false,message:'Coupon code not recognised.'};if(scope&&c.scope!==scope)return {ok:false,message:'This coupon is not valid for this service.'};if(Number(total)<c.min)return {ok:false,message:`Minimum order value is ₹${Number(c.min).toLocaleString('en-IN')}.`};let d=c.type==='percent'?Number(total)*c.value/100:c.value;if(c.max)d=Math.min(d,c.max);d=Math.min(d,Number(total));return {ok:true,code:String(code).trim().toUpperCase(),discount:Math.round(d*100)/100,final:Math.round((Number(total)-d)*100)/100,label:c.label};};
window.copyLPCoupon=function(code,button){navigator.clipboard?.writeText(code).then(()=>{const old=button.textContent;button.textContent='COPIED';setTimeout(()=>button.textContent=old,1200)}).catch(()=>{window.prompt('Copy coupon code:',code)})};
