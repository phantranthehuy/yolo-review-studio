(function(){
'use strict';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const pending=new WeakMap();
for(const details of document.querySelectorAll('details.helpDetails,details.settingsFold,details.analysisFold')){
 const summary=details.querySelector(':scope > summary');
 const body=details.querySelector(':scope > .helpBody,:scope > .foldBody');
 if(!summary||!body)continue;
 summary.addEventListener('click',event=>{
  if(reduced.matches||typeof details.animate!=='function')return;
  event.preventDefault();
  const prior=pending.get(details);
  const opening=prior?!prior.open:!details.open;
  const current=details.getBoundingClientRect().height;
  if(prior){prior.animation.cancel();pending.delete(details);}
  // Measure true closed/open heights in the same frame, without painting either intermediate state.
  details.style.height='';details.style.overflow='';
  details.open=false;
  const closed=details.getBoundingClientRect().height;
  details.open=true;
  const expanded=details.getBoundingClientRect().height;
  const from=prior?current:(opening?closed:expanded);
  const to=opening?expanded:closed;
  details.style.height=from+'px';
  details.style.overflow='hidden';
  details.style.overflowAnchor='none';
  if(Math.abs(to-from)<1){details.open=opening;details.style.height='';details.style.overflow='';details.style.overflowAnchor='';return;}
  const animation=details.animate([{height:from+'px'},{height:to+'px'}],{
    duration:opening?410:390,easing:'cubic-bezier(.4,0,.2,1)',fill:'none'
  });
  pending.set(details,{animation,open:opening});
  animation.onfinish=()=>{
    if(pending.get(details)?.animation!==animation)return;
    details.style.height=to+'px';
    details.open=opening;
    details.style.height='';details.style.overflow='';details.style.overflowAnchor='';
    pending.delete(details);
  };
 });
}
})();