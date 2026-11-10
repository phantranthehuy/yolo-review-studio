(function(){
'use strict';
const dock=document.getElementById('jumpDock');
const panel=document.getElementById('jumpPanel');
const toggle=document.getElementById('jumpToggle');
const indicator=document.getElementById('jumpActiveIndicator');
const links=Array.from(panel.querySelectorAll('.jumpLink'));
const mobile=window.matchMedia('(max-width: 1320px)');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let open=false,scrollFrame=0,indicatorReady=false,spyFrame=0;
function positionIndicator(link){
 if(mobile.matches||!link||!indicator)return;
 const pos=link.getBoundingClientRect(),p=panel.getBoundingClientRect();
 if(!indicatorReady)indicator.style.transition='none';
 indicator.style.width=pos.width+'px';indicator.style.height=pos.height+'px';
 indicator.style.transform=`translate3d(${pos.left-p.left-panel.clientLeft}px,${pos.top-p.top-panel.clientTop}px,0)`;
 if(!indicatorReady){indicatorReady=true;requestAnimationFrame(()=>{
   indicator.classList.add('ready');
   requestAnimationFrame(()=>indicator.style.transition='');
 });}
}
function activate(link){
 if(!link)return;
 for(const a of links){
   a.classList.toggle('isActive',a===link);
   if(a===link)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
 }
 positionIndicator(link);
}
function setOpen(next){
 open=!!next;
 dock.dataset.open=String(open);
 toggle.setAttribute('aria-expanded',String(open));
 panel.setAttribute('aria-hidden',String(!open));
 panel.inert=!open;
 for(const a of links)a.tabIndex=open?0:-1;
}
function syncForViewport(){setOpen(!mobile.matches);requestAnimationFrame(()=>positionIndicator(panel.querySelector('.jumpLink.isActive')||links[0]));}
syncForViewport();
if(mobile.addEventListener)mobile.addEventListener('change',syncForViewport);
else mobile.addListener(syncForViewport);
toggle.addEventListener('click',()=>{if(mobile.matches)setOpen(!open);});
const root=document.documentElement;
const savedScrollBehavior=root.style.scrollBehavior;
function cancelScroll(){if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=0;root.style.scrollBehavior=savedScrollBehavior;}}
function glideTo(target){
 cancelScroll();const y0=window.scrollY;
 const offset=dock.getBoundingClientRect().height+27;
 const y1=Math.max(0,Math.min(root.scrollHeight-window.innerHeight,target.getBoundingClientRect().top+y0-offset));
 const dy=y1-y0;
 if(reduced.matches||Math.abs(dy)<3){window.scrollTo({top:y1,behavior:'instant'});return;}
 root.style.scrollBehavior='auto';
 const duration=Math.max(440,Math.min(840,460+Math.abs(dy)*.075));
 const t0=performance.now();
 function frame(now){const p=Math.min(1,(now-t0)/duration),ease=1-(1-p)**4;window.scrollTo(0,y0+dy*ease);
  if(p<1)scrollFrame=requestAnimationFrame(frame);else{scrollFrame=0;root.style.scrollBehavior=savedScrollBehavior;updateScrollSpy();}}
 scrollFrame=requestAnimationFrame(frame);
}
for(const a of links)a.addEventListener('click',event=>{
 const section=document.getElementById(a.dataset.jump);if(!section)return;
 event.preventDefault();activate(a);
 if(mobile.matches)setOpen(false);
 try{history.replaceState(null,'','#'+encodeURIComponent(a.dataset.jump));}catch(e){}
 glideTo(section);
});
for(const type of ['wheel','touchstart'])window.addEventListener(type,()=>{if(scrollFrame)cancelScroll();},{passive:true});
document.addEventListener('pointerdown',event=>{if(mobile.matches&&open&&!dock.contains(event.target))setOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&open){setOpen(false);toggle.focus();}});
function updateScrollSpy(){
 if(scrollFrame)return;
 // A single active tab, even while passing through long sections or small screens.
 const line=Math.max(125,Math.min(410,window.innerHeight*.46));
 let best=links[0];
 for(const a of links){const el=document.getElementById(a.dataset.jump);if(el && el.getBoundingClientRect().top<=line)best=a;}
 activate(best);
}
window.addEventListener('scroll',()=>{
 if(spyFrame || scrollFrame)return;
 spyFrame=requestAnimationFrame(()=>{spyFrame=0;updateScrollSpy();});
},{passive:true});
window.addEventListener('resize',()=>requestAnimationFrame(()=>{updateScrollSpy();positionIndicator(panel.querySelector('.jumpLink.isActive')||links[0]);}));
updateScrollSpy();

const feedbackLink=document.getElementById('feedbackLink');
const coordsSection=document.getElementById('coordsSection');
function updateFeedbackVisibility(){
 feedbackLink.hidden=coordsSection.getBoundingClientRect().top<window.innerHeight;
}
window.addEventListener('scroll',updateFeedbackVisibility,{passive:true});
window.addEventListener('resize',updateFeedbackVisibility);
window.addEventListener('pageshow',updateFeedbackVisibility);
if(window.ResizeObserver){
 const feedbackLayoutObserver=new ResizeObserver(updateFeedbackVisibility);
 feedbackLayoutObserver.observe(coordsSection.closest('main'));
}
updateFeedbackVisibility();
})();