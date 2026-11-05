(function(){
 'use strict';
 const f=document.getElementById('coord_floatingTools');
 const info=document.getElementById('coordMobileInfoBar');
 const menu=document.getElementById('coord_moreMenu');
 if(!f||!info||!menu)return;
 // Embed information with controls in one viewport-bottom bar. No separate overlay.
 f.insertBefore(info,f.querySelector('.coordMobileRail'));
 const pairs=[
  ['coord_copySelected','coord_actionCopy'],
  ['coord_copySelectedId','coord_actionNote'],
  ['coord_removeSelected','coord_actionDelete']
 ];
 for(const [buttonId,originalId] of pairs){
  const btn=document.getElementById(buttonId),orig=document.getElementById(originalId);
  if(btn&&orig)btn.addEventListener('click',()=>orig.click());
 }
 function state(){
  const name=document.getElementById('coord_selectedName').textContent.trim();
  const chosen=name && name!=='Chưa chọn box' && name!=='Đang khoanh vùng mới';
  const drawn=/^Box #/.test(name);
  const b1=document.getElementById('coord_copySelected'),b2=document.getElementById('coord_copySelectedId'),b3=document.getElementById('coord_removeSelected');
  if(b1)b1.disabled=!chosen;
  if(b2)b2.disabled=!chosen;
  if(b3)b3.disabled=!drawn;
 }
 const selected=document.getElementById('coord_selectedName');
 new MutationObserver(state).observe(selected,{subtree:true,childList:true,characterData:true});
 state();
 // Reduce mobile UI collision: clicking canvas does not close popup until a new target selection.
 window.addEventListener('coord-dock-update',state);
})();