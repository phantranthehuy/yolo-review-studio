
(function(){
 'use strict';
 const canvas=document.getElementById('fallingFlowers'),context=canvas.getContext('2d');
 if(!context)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,fieldHeight=0,flowers=[],frame=0,lastFrame=0,fallTime=0;
 let scrollY=window.scrollY,lastScroll=0,scrollSpeed=0,fallSpeed=1;
 function resetFlower(flower,initial){
  flower.x=Math.random()*width;
  flower.y=initial?Math.random()*fieldHeight:-24-Math.random()*60;
  flower.radius=4+Math.random()*3.5;
  flower.speed=16+Math.random()*17;
  flower.phase=Math.random()*Math.PI*2;
  flower.angle=Math.random()*Math.PI*2;
  flower.spin=(Math.random()-.5)*.55;
  flower.drift=8+Math.random()*15;
  flower.color=Math.random()>.45?'#efb9c9':'#f2d8df';
  return flower;
 }
 function updateField(){
  fieldHeight=Math.max(height,document.documentElement.scrollHeight);
  const count=Math.min(300,Math.ceil((width<=720?8:16)*fieldHeight/Math.max(1,height)));
  while(flowers.length<count)flowers.push(resetFlower({},true));
  flowers.length=count;
  for(const flower of flowers)if(flower.y>fieldHeight+24)resetFlower(flower,true);
 }
 function resize(){
  const oldWidth=width;
  width=innerWidth;height=innerHeight;
  if(oldWidth)for(const flower of flowers)flower.x*=width/oldWidth;
  const ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  context.setTransform(ratio,0,0,ratio,0,0);
  updateField();
 }
 function onScroll(){
  const now=performance.now(),elapsed=Math.max(16,Math.min(80,now-lastScroll));
  const distance=Math.abs(window.scrollY-scrollY);
  if(distance>0){
   scrollSpeed=distance/elapsed;
   scrollY=window.scrollY;lastScroll=now;
  }
 }
 function drawFlower(flower){
  const sway=Math.sin(fallTime*.65+flower.phase)*flower.drift;
  context.save();
  context.translate(flower.x+sway,flower.y-window.scrollY);context.rotate(flower.angle);
  context.fillStyle=flower.color;
  for(let petal=0;petal<5;petal++){
   context.rotate(Math.PI*2/5);
   context.beginPath();
   context.ellipse(0,-flower.radius*.6,flower.radius*.42,flower.radius*.68,0,0,Math.PI*2);
   context.fill();
  }
  context.fillStyle='#e3b77c';context.beginPath();context.arc(0,0,flower.radius*.2,0,Math.PI*2);context.fill();
  context.restore();
 }
 function animate(now){
  const delta=lastFrame?Math.min((now-lastFrame)/1000,.05):0;
  lastFrame=now;
  const scrolling=now-lastScroll<120;
  const target=scrolling?(scrollSpeed>=1.2?0:Math.max(.04,1-scrollSpeed/1.2)):1;
  // Respond quickly to scrolling, then gently resume after scrolling stops.
  fallSpeed+=(target-fallSpeed)*(1-Math.exp(-delta*(scrolling?24:5)));
  if(scrolling&&target===0&&fallSpeed<.03)fallSpeed=0;
  const step=delta*fallSpeed;
  fallTime+=step;
  context.clearRect(0,0,width,height);
  for(const flower of flowers){
   flower.y+=flower.speed*step;
   flower.angle+=flower.spin*step;
   if(flower.y>fieldHeight+24)resetFlower(flower,false);
   const screenY=flower.y-window.scrollY;
   if(screenY>=-24&&screenY<=height+24)drawFlower(flower);
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
 reduced.addEventListener('change',syncMotion);
 resize();
 new ResizeObserver(updateField).observe(document.body);
 syncMotion();
})();
