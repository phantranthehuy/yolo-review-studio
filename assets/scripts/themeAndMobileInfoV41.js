(function(){
'use strict';
const root=document.documentElement,toggle=document.getElementById('themeToggle'),label=document.getElementById('themeToggleLabel');
// The chosen HTML entry page is authoritative: Dark starts dark;
// Default, Forest, Sakura, Flower and index always start light.
// Never reuse a saved Dark choice on a light entry page.
let dark=root.getAttribute('data-theme')==='dark';
function applyTheme(next){
 dark=!!next;root.setAttribute('data-theme',dark?'dark':'light');
 toggle.setAttribute('aria-pressed',String(dark));
 toggle.setAttribute('aria-label',dark?'Bật chế độ sáng':'Bật chế độ tối');
 toggle.title=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
 label.textContent=dark?'Chế độ sáng':'Chế độ tối';
 toggle.querySelector('svg').innerHTML=dark?
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>':
  '<path d="M20.5 13.2A8.4 8.4 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"/>';
}
applyTheme(dark);
toggle.addEventListener('click',()=>applyTheme(!dark));
// Floating toolbar footer uses the same selected-box values as the desktop bar.
const dock=document.getElementById('coordMobileInfoBar'),section=document.getElementById('coordsSection'),
 name=document.getElementById('coord_selectedName'),pos=document.getElementById('coord_coord'),details=document.getElementById('coord_details'),
 outName=document.getElementById('coordMobileInfoName'),outPos=document.getElementById('coordMobileInfoPosition'),outDetails=document.getElementById('coordMobileInfoDimensions');
if(!dock||!section||!name||!pos||!details)return;
let pending=false;
function update(){
 pending=false;
 const r=section.getBoundingClientRect();
 const inside=r.bottom>75 && r.top<window.innerHeight-75;
 const selected=name.textContent.trim();
 const coordinate=pos.textContent.trim();
 const valid=selected && selected!=='Chưa chọn box' && selected!=='Đang khoanh vùng mới' && coordinate && coordinate!=='—';
 const show=window.matchMedia('(width < 1160px)').matches && inside && (valid || !!window.YoloCoordsCanvasEngaged?.());
 dock.hidden=!show;
 if(show){outName.textContent=valid?selected:'Vùng ảnh';outPos.textContent=valid?coordinate:'Chạm box để xem tọa độ';outDetails.textContent=valid?details.textContent.trim():'';}
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(update)}
for(const el of [name,pos,details])new MutationObserver(schedule).observe(el,{subtree:true,childList:true,characterData:true});
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('coord-dock-update',schedule);
const stage=document.getElementById('coord_stageShell');
if(stage)new MutationObserver(schedule).observe(stage,{attributes:true,attributeFilter:['class','hidden']});
schedule();
})();