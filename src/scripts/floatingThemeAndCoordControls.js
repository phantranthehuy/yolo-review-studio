
(function(){
 const dock=document.getElementById('jumpDock'),toggle=document.getElementById('themeToggle');
 if(!dock||!toggle)return;
 const home=toggle.parentElement,placeholder=document.createElement('span');
 placeholder.setAttribute('aria-hidden','true');placeholder.style.display='none';home.insertBefore(placeholder,toggle);
 const marker=document.createElement('div');marker.style.cssText='height:0;pointer-events:none';dock.before(marker);
 let floating=false,frame=0,motion;
 function sizeThemeButton(){
  const surface=document.getElementById(innerWidth<=1320?'jumpToggle':'jumpPanel');
  const height=surface.getBoundingClientRect().height;
  // Navigation can wrap on narrow desktops. Keep the icon button compact,
  // and ignore expanded mobile-menu height when crossing the breakpoint.
  const size=Math.round(Math.min(64,Math.max(40,height||52)));
  const value=size+'px';
  if(dock.style.getPropertyValue('--theme-size')!==value)dock.style.setProperty('--theme-size',value);
 }
 const themeSizeObserver=new ResizeObserver(sizeThemeButton);
 themeSizeObserver.observe(dock);
 themeSizeObserver.observe(document.getElementById('jumpToggle'));
 themeSizeObserver.observe(document.getElementById('jumpPanel'));
 addEventListener('resize',sizeThemeButton,{passive:true});
 sizeThemeButton();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function update(){
  frame=0;
  const top=parseFloat(getComputedStyle(dock).top)||8;
  const next=marker.getBoundingClientRect().top<top;
  if(next===floating)return;
  if(motion)motion.cancel();
  const before=toggle.getBoundingClientRect();
  floating=next;
  if(next){
   placeholder.style.cssText='display:inline-block;width:'+before.width+'px;height:'+before.height+'px;flex:0 0 auto';
   dock.classList.add('themeDocked');dock.append(toggle);
  }else{
   dock.classList.remove('themeDocked');home.insertBefore(toggle,placeholder.nextSibling);placeholder.style.display='none';
  }
  const after=toggle.getBoundingClientRect();
  if(!reduced.matches){
   const dx=before.left-after.left,dy=before.top-after.top;
   motion=toggle.animate([
    {transform:'translate('+dx+'px,'+dy+'px) scale('+before.width/after.width+','+before.height/after.height+')',opacity:1},
    {transform:'translate(0,0) scale(1)',opacity:1}
   ],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});
  }
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);update();
 const select=document.getElementById('coord_format');
 if(select){
  const group=document.createElement('div');group.className='coordFormatChoices';group.setAttribute('role','group');group.setAttribute('aria-label','Định dạng tọa độ');group.append('Toạ độ:');
  for(const value of ['integer','exact']){
   const button=document.createElement('button');button.type='button';button.textContent=value==='integer'?'N':'0.123';
   button.title=value==='integer'?'Toạ độ số nguyên':'Toạ độ thập phân';button.setAttribute('aria-label',button.title);
   button.dataset.value=value;
   button.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
   group.append(button);
  }
  select.after(group);
  function sync(){group.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.value===select.value));b.disabled=select.disabled;});}
  select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{attributes:true,attributeFilter:['disabled']});sync();
 }
})();
