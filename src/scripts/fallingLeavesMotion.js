
(function(){
 'use strict';
 const canvas=document.getElementById('fallingLeaves');
 const context=canvas&&canvas.getContext('2d');
 if(!context)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const colorsLight=['#a77531','#b78d45','#8b9351','#c19d4b','#925d37','#86965e'];
 const colorsDark=['#d0a157','#b6843f','#aab574','#c08b4d','#ae783b','#889964'];
 let width=0,height=0,fieldHeight=0,leaves=[],frame=0,lastFrame=0,fallTime=0;
 let scrollY=window.scrollY,lastScroll=0,scrollSpeed=0,fallSpeed=1;
 function resetLeaf(leaf,initial){
  leaf.x=Math.random()*width;
  leaf.y=initial?Math.random()*fieldHeight:-32-Math.random()*70;
  leaf.size=5+Math.random()*5.7;
  leaf.speed=21+Math.random()*30;
  leaf.phase=Math.random()*Math.PI*2;
  leaf.angle=Math.random()*Math.PI*2;
  leaf.spin=(Math.random()-.5)*1.15;
  leaf.drift=9+Math.random()*24;
  leaf.tilt=Math.random()*Math.PI*2;
  leaf.flipSpeed=1+Math.random()*1.45;
  leaf.colorIndex=Math.floor(Math.random()*colorsLight.length);
  leaf.alpha=.55+Math.random()*.35;
  return leaf;
 }
 function updateField(){
  fieldHeight=Math.max(height,document.documentElement.scrollHeight);
  const count=Math.min(260,Math.ceil((width<=720?7:14)*fieldHeight/Math.max(1,height)));
  while(leaves.length<count)leaves.push(resetLeaf({},true));
  leaves.length=count;
  for(const leaf of leaves)if(leaf.y>fieldHeight+30)resetLeaf(leaf,true);
 }
 function resize(){
  const oldWidth=width;
  width=innerWidth;height=innerHeight;
  if(oldWidth)for(const leaf of leaves)leaf.x*=width/oldWidth;
  const ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  context.setTransform(ratio,0,0,ratio,0,0);
  updateField();
 }
 function onScroll(){
  const now=performance.now(),elapsed=Math.max(16,Math.min(80,now-lastScroll));
  const distance=Math.abs(window.scrollY-scrollY);
  if(distance>0){scrollSpeed=distance/elapsed;scrollY=window.scrollY;lastScroll=now;}
 }
 function drawLeaf(leaf){
  const sway=Math.sin(fallTime*.74+leaf.phase)*leaf.drift;
  const flutter=Math.cos(fallTime*leaf.flipSpeed+leaf.tilt);
  const size=leaf.size;
  const palette=document.documentElement.dataset.theme==='dark'?colorsDark:colorsLight;
  context.save();
  context.translate(leaf.x+sway,leaf.y-window.scrollY);
  context.rotate(leaf.angle+Math.sin(fallTime*.8+leaf.phase)*.3);
  context.scale(.4+.6*Math.abs(flutter),1);
  context.globalAlpha=leaf.alpha;
  context.fillStyle=palette[leaf.colorIndex];
  context.beginPath();
  context.moveTo(0,-size*1.25);
  context.bezierCurveTo(size*.72,-size*.95,size*.91,-size*.02,size*.38,size*.62);
  context.quadraticCurveTo(size*.15,size*.97,0,size*1.2);
  context.bezierCurveTo(-size*.74,size*.61,-size*.94,-size*.37,0,-size*1.25);
  context.closePath();
  context.fill();
  context.strokeStyle='rgba(60,67,37,.42)';
  context.lineWidth=Math.max(.48,size*.08);
  context.beginPath();
  context.moveTo(0,-size*.98);
  context.quadraticCurveTo(size*.10,0,0,size*1.26);
  context.stroke();
  context.restore();
 }
 function animate(now){
  const delta=lastFrame?Math.min((now-lastFrame)/1000,.05):0;
  lastFrame=now;
  const scrolling=now-lastScroll<120;
  const target=scrolling?(scrollSpeed>=1.2?0:Math.max(.04,1-scrollSpeed/1.2)):1;
  fallSpeed+=(target-fallSpeed)*(1-Math.exp(-delta*(scrolling?24:5)));
  if(scrolling&&target===0&&fallSpeed<.03)fallSpeed=0;
  const step=delta*fallSpeed;
  fallTime+=step;
  context.clearRect(0,0,width,height);
  for(const leaf of leaves){
   leaf.y+=leaf.speed*step;
   leaf.angle+=leaf.spin*step;
   if(leaf.y>fieldHeight+30)resetLeaf(leaf,false);
   const screenY=leaf.y-window.scrollY;
   if(screenY>=-30&&screenY<=height+30)drawLeaf(leaf);
  }
  frame=requestAnimationFrame(animate);
 }
 function syncMotion(){
  cancelAnimationFrame(frame);frame=0;lastFrame=0;
  if(reduced.matches||document.hidden){context.clearRect(0,0,width,height);return;}
  scrollY=window.scrollY;lastScroll=0;scrollSpeed=0;fallSpeed=1;
  frame=requestAnimationFrame(animate);
 }
 addEventListener('scroll',onScroll,{passive:true});
 addEventListener('resize',resize,{passive:true});
 document.addEventListener('visibilitychange',syncMotion);
 if(reduced.addEventListener)reduced.addEventListener('change',syncMotion);
 else if(reduced.addListener)reduced.addListener(syncMotion);
 resize();
 new ResizeObserver(updateField).observe(document.body);
 syncMotion();
})();
