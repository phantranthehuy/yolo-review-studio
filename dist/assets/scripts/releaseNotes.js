(function(){
 'use strict';
 const viewport=document.getElementById('releaseNotesViewport');
 if(!viewport)return;
 const track=viewport.querySelector('.releaseNotesTrack');
 const group=track.querySelector('.releaseNotesGroup');
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let cycleHeight=0,position=0,frame=0,lastTime=0;
 let visible=false,hovered=false,focused=false,scrollingDown=false,touchPaused=false;
 let touchTimer=0,lastPageY=Math.max(0,window.scrollY);

 // Copies above and below let readers scroll either way without a blank edge.
 const before=group.cloneNode(true),after=group.cloneNode(true);
 for(const copy of [before,after]){
  copy.setAttribute('aria-hidden','true');
  copy.inert=true;
 }
 track.prepend(before);track.append(after);

 function wrap(value){
  return cycleHeight+(value%cycleHeight+cycleHeight)%cycleHeight;
 }
 function tick(time){
  if(lastTime)position=wrap(position+Math.min(time-lastTime,64)*(reducedMotion.matches ? .006 : .012));
  lastTime=time;
  viewport.scrollTop=position;
  frame=requestAnimationFrame(tick);
 }
 function updatePlayback(){
  const running=visible&&!hovered&&!focused&&!scrollingDown&&!touchPaused
   &&!document.hidden&&cycleHeight>0;
  if(running&&!frame){
   position=viewport.scrollTop;lastTime=0;
   frame=requestAnimationFrame(tick);
  }else if(!running&&frame){
   cancelAnimationFrame(frame);frame=0;lastTime=0;
   position=viewport.scrollTop;
  }
 }
 function measure(){
  const previous=cycleHeight;
  cycleHeight=group.getBoundingClientRect().height;
  if(cycleHeight>0){
   position=previous?wrap(viewport.scrollTop/previous*cycleHeight):cycleHeight;
   viewport.scrollTop=position;
  }
  updatePlayback();
 }
 viewport.addEventListener('pointerenter',event=>{
  if(event.pointerType==='touch')return;
  hovered=true;updatePlayback();
 });
 viewport.addEventListener('pointerleave',event=>{
  if(event.pointerType==='touch')return;
  hovered=false;focused=viewport.matches(':focus-visible');updatePlayback();
 });
 viewport.addEventListener('focusin',()=>{focused=viewport.matches(':focus-visible');updatePlayback();});
 viewport.addEventListener('focusout',()=>{focused=false;updatePlayback();});
 viewport.addEventListener('scroll',()=>{
  if(frame||!cycleHeight)return;
  position=wrap(viewport.scrollTop);
  if(Math.abs(viewport.scrollTop-position)>1)viewport.scrollTop=position;
 },{passive:true});
 viewport.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  clearTimeout(touchTimer);touchPaused=true;updatePlayback();
 });
 function resumeAfterTouch(event){
  if(event.pointerType!=='touch')return;
  clearTimeout(touchTimer);
  touchTimer=setTimeout(()=>{touchPaused=false;updatePlayback();},2000);
 }
 window.addEventListener('pointerup',resumeAfterTouch);
 window.addEventListener('pointercancel',resumeAfterTouch);
 window.addEventListener('scroll',()=>{
  const nextY=Math.max(0,window.scrollY);
  if(nextY===lastPageY)return;
  scrollingDown=nextY>0&&nextY>lastPageY;
  lastPageY=nextY;updatePlayback();
 },{passive:true});
 document.addEventListener('visibilitychange',updatePlayback);
 reducedMotion.addEventListener('change',updatePlayback);
 const visibility=new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;updatePlayback();
 });
 visibility.observe(viewport);
 const resize=new ResizeObserver(measure);
 resize.observe(group);
 measure();
})();
