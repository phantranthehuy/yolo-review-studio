(function(){
'use strict';
const $=id=>document.getElementById(id);
const float=$('coord_floatingTools'),section=$('coordsSection');
if(!float||!section)return;
const NS='http://www.w3.org/2000/svg';
function svg(paths){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;}
const icons={
 hand:svg('<path d="M8 13V6a1.7 1.7 0 0 1 3.4 0v5-6.5a1.7 1.7 0 0 1 3.4 0V11 7a1.7 1.7 0 0 1 3.4 0v4-1a1.7 1.7 0 0 1 3.4 0v5c0 4.2-3.4 7.5-7.5 7.5h-2.3c-2.4 0-4.4-1-5.8-2.8l-3.9-5a1.9 1.9 0 0 1 2.9-2.4L8 16"/>'),
 brush:svg('<path d="M21 3c-3 0-7 2.5-10 7.5L8 14l3 3 3.5-3C19.5 11 22 7 21 3Z"/><path d="M9 15c-3-1-5 .6-5 3.1 0 1.4-.5 2.4-1 2.9 3.1.3 8 .3 8-4.6"/>'),
 crosshair:svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
 search:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/>'),
 square:svg('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
 tag:svg('<path d="M4 4h9l8 8-9 9-8-8z"/><circle cx="9" cy="9" r="1.1"/>'),
 more:svg('<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
 arrow:svg('<path d="m6 9 6 6 6-6"/>')
};
const rail=document.createElement('div');rail.className='coordMobileRail';rail.setAttribute('role','group');rail.setAttribute('aria-label','Công cụ tọa độ trên điện thoại');
const fly=document.createElement('div');fly.className='coordMobileFlyout';fly.id='coord_mobileFlyout';fly.hidden=true;fly.setAttribute('role','dialog');fly.setAttribute('aria-label','Lựa chọn công cụ');
float.append(rail,fly);
if(fly.showPopover)fly.setAttribute('popover','manual');
function add(id,content,title,click){let b=document.createElement('button');b.type='button';b.className='coordMobileButton';b.id='coord_m_'+id;b.title=title;b.setAttribute('aria-label',title);b.innerHTML=content;b.addEventListener('click',click);rail.append(b);return b;}
const buttons={};let expanded=true,activeFly='',lastOrigin=null,manualRail=false;
function closeFly(){if(fly.hidePopover&&fly.matches(':popover-open'))fly.hidePopover();fly.hidden=true;activeFly='';lastOrigin=null;syncZoomSlider=null;for(const b of Object.values(buttons))b.setAttribute('aria-expanded','false');}
let railMotion,railReveal,railTransition=0;
function collapse(next,userAction=true){
 if(userAction)manualRail=true;
 const transition=++railTransition;
 // Sample a running transition before cancelling, so repeated clicks reverse
 // from the current frame rather than jumping back to the first frame.
 const wasAnimating=!!railReveal;
 const currentClip=wasAnimating?getComputedStyle(float).clipPath:null;
 const currentOpacity=wasAnimating?getComputedStyle(rail).opacity:null;
 railMotion?.cancel();railReveal?.cancel();
 railMotion=null;railReveal=null;
 closeFly();
 function apply(collapsed){
  expanded=!collapsed;float.classList.toggle('coordMobileCollapsed',collapsed);
  buttons.collapse.setAttribute('aria-expanded',String(!collapsed));
  updateRailContext();window.YoloCoords?.refresh();
 }
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(width < 1160px)').matches){apply(next);return;}
 const wasCollapsed=float.classList.contains('coordMobileCollapsed');
 // Keep the expanded layout until the closing animation ends. Only its mask
 // changes; icons retain their actual size and the right edge stays anchored.
 if(wasCollapsed)apply(false);
 const width=float.offsetWidth,height=float.offsetHeight;
 const half=21.5,centerX=width-26,centerY=height/2;
 const compact='inset('+Math.max(0,centerY-half)+'px '+Math.max(0,width-centerX-half)+'px '+Math.max(0,centerY-half)+'px '+Math.max(0,centerX-half)+'px round 22px 22px 22px 22px)';
 const full='inset(0px 0px 0px 0px round 15px 0px 0px 15px)';
 const from=wasAnimating&&currentClip&&currentClip!=='none'?currentClip:(wasCollapsed?compact:full);
 const duration=next?280:340;
 const timing={duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
 railReveal=float.animate([{clipPath:from},{clipPath:next?compact:full}],timing);
 railMotion=rail.animate([
  {opacity:wasAnimating?currentOpacity:(wasCollapsed?0:1)},
  {opacity:next?0:1}
 ],{...timing,duration:next?200:300});
 const reveal=railReveal,motion=railMotion;
 reveal.finished.then(()=>{
  if(transition!==railTransition)return;
  apply(next);reveal.cancel();motion.cancel();
  railReveal=null;railMotion=null;
 }).catch(()=>{});
}
buttons.collapse=add('collapse',icons.arrow,'Thu gọn thành nút hình cọ',()=>collapse(true));buttons.collapse.classList.add('coordMobileCollapse');buttons.collapse.setAttribute('aria-expanded','true');
buttons.hand=add('hand',icons.hand,'Bàn tay — chọn hoặc di chuyển box (V hoặc D)',()=>{$('coord_toolSelect').click();closeFly();sync()});
buttons.brush=add('brush',icons.brush,'Bút vẽ — khoanh box (B)',()=>{$('coord_toolDraw').click();closeFly();sync()});
buttons.txt=add('txt','<strong class="coordMobileTxt">TXT</strong>','Chọn box theo dòng TXT',()=>showFly('txt',buttons.txt));
buttons.format=add('format',icons.crosshair,'Chọn loại tọa độ',()=>showFly('format',buttons.format));
buttons.zoom=add('zoom',icons.search,'Chọn độ phóng đại',()=>showFly('zoom',buttons.zoom));
buttons.box=add('box',icons.square,'Ẩn/hiện đường viền box TXT',()=>toggleCheck('coord_showBoxes'));
buttons.lines=add('lines','<span class="coordMobileLabelText">TXT</span>','Ẩn/hiện số dòng TXT',()=>toggleCheck('coord_showNumbers'));
buttons.tags=add('tags',icons.tag,'Ẩn/hiện nhãn tọa độ đã vẽ',()=>toggleCheck('coord_showRegionLabels'));
buttons.more=add('more',icons.more,'Khác',()=>showFly('more',buttons.more));
buttons.orb=add('open',icons.brush,'Mở thanh công cụ tọa độ',()=>collapse(false));buttons.orb.classList.add('coordMobileCompactBrush');
function toggleCheck(id){const checkbox=$(id);if(checkbox.disabled)return;checkbox.checked=!checkbox.checked;checkbox.dispatchEvent(new Event('change',{bubbles:true}));sync();}
function row(text,fn,selected=false,disabled=false){const b=document.createElement('button');b.type='button';b.className='coordFlyRow';b.textContent=text;b.disabled=disabled;b.setAttribute('aria-selected',String(selected));b.onclick=()=>{fn();closeFly();sync();};fly.append(b);return b;}
function info(text){const p=document.createElement('div');p.className='coordFlyInfo';p.textContent=text;fly.append(p);}
let syncZoomSlider,zoomApplyTimer;
function showFly(name,origin){if(!expanded)return; if(activeFly===name&&!fly.hidden){closeFly();return;}activeFly=name;lastOrigin=origin;syncZoomSlider=null;fly.replaceChildren();
 const close=document.createElement('button');close.type='button';close.className='coordFlyClose';close.textContent='×';close.setAttribute('aria-label','Đóng bảng');close.onclick=closeFly;fly.append(close);
 const title=document.createElement('h3');title.className='coordFlyHeading';title.textContent=({txt:'Chọn dòng TXT',format:'Định dạng tọa độ',zoom:'Độ phóng đại',more:'Khác'})[name]||'';fly.append(title);
 if(name==='txt'){
   const original=$('coord_boxSelect');
   if(original.disabled||original.options.length<2)info('Chưa có nhãn TXT cho ảnh này.');
   else{const menu=document.createElement('select');menu.setAttribute('aria-label','Dòng TXT');for(const item of original.options){const op=document.createElement('option');op.value=item.value;op.textContent=item.textContent;menu.append(op);}menu.value=original.value;menu.onchange=()=>{if(menu.value==='')return;original.value=menu.value;original.dispatchEvent(new Event('change',{bubbles:true}));closeFly();sync();};fly.append(menu);}
   const selected=$('coord_selectedName')?.textContent,coordinates=$('coord_coord')?.textContent;
   if(selected&&selected!=='Chưa chọn box')info(selected+(coordinates&&coordinates!=='—'?' · '+coordinates:''));
 }else if(name==='format'){
   const choices=document.createElement('div');choices.className='coordFormatChoices';choices.append('Toạ độ:');for(const val of ['integer','exact']){const b=document.createElement('button');b.type='button';b.textContent=val==='integer'?'N':'0.123';b.title=val==='integer'?'Toạ độ số nguyên':'Toạ độ thập phân';b.setAttribute('aria-pressed',String($('coord_format').value===val));b.onclick=()=>{$('coord_format').value=val;$('coord_format').dispatchEvent(new Event('change',{bubbles:true}));choices.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));};choices.append(b);}fly.append(choices);
 }else if(name==='zoom'){
   const slider=document.createElement('input');slider.type='range';
   slider.min=String(Math.max(1,Math.floor(Math.min(.1,window.YoloCoords.getFitScale())*100)));
   slider.max=String(Math.ceil(window.YoloCoords.getMaxZoom()*100));
   slider.step='1';slider.setAttribute('aria-label','Kéo chọn mức zoom');
   const marks=document.createElement('div');marks.className='coordFlyZoomMarks';
   const current=document.createElement('strong');
   current.className='coordFlyZoomValue';
   const minimum=document.createElement('span');
   const maximum=document.createElement('span');
   minimum.textContent=slider.min+'%';maximum.textContent=slider.max+'%';
   marks.append(minimum,maximum);
   function showZoomValue(){
     const label=slider.value+'%';
     slider.setAttribute('aria-valuetext',label);current.textContent=label;
   }
   slider.oninput=()=>{
     showZoomValue();
     clearTimeout(zoomApplyTimer);
     const value=Number(slider.value)/100;
     zoomApplyTimer=setTimeout(()=>window.YoloCoords.setZoom(value),300);
   };
   fly.append(current,slider,marks);
   syncZoomSlider=()=>{
     slider.value=String(Math.round(window.YoloCoords.getZoom()*100));
     showZoomValue();
   };
   syncZoomSlider();
 }else if(name==='more'){
   const fullscreen=$('coord_fullscreen');
   row(fullscreen.textContent,()=>fullscreen.click()).dataset.actionIcon=fullscreen.dataset.actionIcon;
   const actions=[['Chép tọa độ box đang chọn','coord_actionCopy'],['Chép ID + box','coord_actionNote'],['Chép tất cả tọa độ','coord_copyAll'],['Ghi vùng vào notes trong log','coord_applyNote'],['Xóa box đã vẽ đang chọn','coord_actionDelete'],['Xóa tất cả box đã vẽ','coord_deleteAll']];
   for(const [label,id] of actions)row(label,()=>{$(id).click()},false,!!$(id).disabled || ((id==='coord_actionCopy'||id==='coord_actionNote')&&$('coord_selectedName').textContent==='Chưa chọn box') || (id==='coord_actionDelete' && !/^Box #/.test($('coord_selectedName').textContent))).dataset.actionIcon=({"coord_actionCopy": "coord-copy", "coord_actionNote": "coord-id", "coord_actionDelete": "coord-delete", "coord_copyAll": "coord-copy-all", "coord_applyNote": "coord-note", "coord_deleteAll": "coord-delete-all"})[id];
   const context=[$('coord_raw').textContent,$('coord_status').textContent].filter(v=>v&&v.trim()).join(' · ');
   if(context)info(context);
 }
 fly.hidden=false;for(const [k,b] of Object.entries(buttons))b.setAttribute('aria-expanded',String(k===name));
 if(fly.showPopover)fly.showPopover();
 positionFly();
}
function positionFly(){
 if(fly.hidden||!lastOrigin)return;
 const bar=float.getBoundingClientRect();
 const footer=$('coordMobileInfoBar');
 const bottom=footer&&!footer.hidden?footer.getBoundingClientRect().top:innerHeight;
 const top=8,limit=Math.max(48,bottom-top-8);
 fly.style.setProperty('--fly-limit',limit+'px');
 const half=fly.offsetHeight/2,button=lastOrigin.getBoundingClientRect();
 const center=Math.min(bottom-8-half,Math.max(top+half,button.top+button.height/2));
 const viewportLayer=!!fly.showPopover;
 fly.style.top=(viewportLayer?center:center-bar.top)+'px';
 fly.style.setProperty('--fly-right',(viewportLayer?innerWidth-bar.left+6:bar.width+6)+'px');
}
function sync(){
 const mode=$('coord_mode').value;
 buttons.hand.setAttribute('aria-pressed',String(mode==='select'));
 buttons.brush.setAttribute('aria-pressed',String(mode==='draw'));
 for(const [id,isOn] of [['hand',mode==='select'],['brush',mode==='draw'],['box',$('coord_showBoxes').checked],['lines',$('coord_showNumbers').checked],['tags',$('coord_showRegionLabels').checked]])buttons[id].dataset.active=String(isOn);
 const hasTxt=!$('coord_boxSelect').disabled;buttons.txt.disabled=!hasTxt;buttons.hand.disabled=$('coord_toolSelect').disabled;buttons.brush.disabled=$('coord_toolDraw').disabled;
 // When pointer exits section 05, mobile rail and flyout disappear together.
 if(float.classList.contains('coordMobileOffscreen'))closeFly();
}
for(const id of ['coord_showBoxes','coord_showNumbers','coord_showRegionLabels','coord_boxSelect','coord_mode','coord_zoom','coord_format'])$(id).addEventListener('change',sync);
$('coord_zoom').addEventListener('change',()=>{clearTimeout(zoomApplyTimer);syncZoomSlider?.();});
$('coord_file').addEventListener('change',()=>clearTimeout(zoomApplyTimer));
for(const id of ['coord_toolSelect','coord_toolDraw'])$(id).addEventListener('click',()=>requestAnimationFrame(sync));
// Dock is a compact brush over the upload/settings panel; expand near the image only.
// Never override a user's explicit expand/collapse choice.
let railQueued=false;
function updateRailContext(){
 if(!matchMedia('(width < 1160px)').matches||float.hidden)return;
 const stage=$('coord_stage').getBoundingClientRect();
 const header=document.querySelector('.appHeader');
 const headerBottom=header && ['sticky','fixed'].includes(getComputedStyle(header).position)
   ? header.getBoundingClientRect().bottom : 0;
 const footer=$('coordMobileInfoBar');
 const top=Math.max(stage.top,headerBottom,0)+5;
 const bottom=Math.min(stage.bottom,window.innerHeight,footer&&!footer.hidden
   ? footer.getBoundingClientRect().top : window.innerHeight)-5;
 const available=bottom-top;
 float.classList.toggle('railOutsideCanvas',available<54);
 if(available<54){if(!fly.hidden)closeFly();return}
 const nav=$('jumpDock').getBoundingClientRect();
 const upper=Math.max(headerBottom,nav.top<=12?nav.bottom:0)+5;
 const lower=Math.min(window.innerHeight,footer&&!footer.hidden?footer.getBoundingClientRect().top:Infinity)-5;
 const room=Math.max(54,lower-upper);
 const rows=Math.max(1,Math.floor((Math.min(room,available)-10)/42));
 const columns=expanded?Math.min(5,Math.ceil(9/Math.max(1,rows-1))):1;
 float.dataset.railLayout=columns>=4?'horizontal':'grid';
 float.style.setProperty('--rail-cols',columns);
 const half=float.offsetHeight/2;
 float.style.setProperty('--coord-mobile-center',Math.min(lower-half,Math.max(upper+half,(top+bottom)/2))+'px');
 positionFly();
}
function queueRailUpdate(){if(railQueued)return;railQueued=true;requestAnimationFrame(()=>{railQueued=false;updateRailContext()})}
const watch=new MutationObserver(()=>{if(float.classList.contains('coordMobileOffscreen')||float.hidden)closeFly();sync();queueRailUpdate();});watch.observe(float,{attributes:true,attributeFilter:['class','hidden']});
window.addEventListener('scroll',queueRailUpdate,{passive:true});
window.addEventListener('resize',queueRailUpdate,{passive:true});
if(window.ResizeObserver){const observer=new ResizeObserver(queueRailUpdate);observer.observe($('coord_stage'));if($('coordMobileInfoBar'))observer.observe($('coordMobileInfoBar'));}
const selectSync=new MutationObserver(sync);selectSync.observe($('coord_boxSelect'),{childList:true,attributes:true,attributeFilter:['disabled']});
document.addEventListener('pointerdown',event=>{if(!fly.hidden&&!fly.contains(event.target)&&!rail.contains(event.target))closeFly();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeFly();});
window.addEventListener('resize',()=>{if(!fly.hidden)closeFly();});
// On mobile, tools are a vertical rail, never a horizontal dock; desktop remains untouched.
sync();window.YoloCoords?.refresh();queueRailUpdate();
})();