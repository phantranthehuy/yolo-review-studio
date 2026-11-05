
(function(){
 'use strict';
 const images=['scenicLightImage','scenicDarkImage'].map(id=>document.getElementById(id));
 let pending=0,viewportHeight=innerHeight,maxScroll=0;
 const sizes=new Map();
 function update(){
  pending=0;
  const progress=maxScroll>0?Math.min(1,Math.max(0,window.scrollY/maxScroll)):0;
  for(const image of images){
   const size=sizes.get(image);
   if(size)image.style.transform='translate3d(-50%,'+(-(size.height-viewportHeight)*progress)+'px,0)';
  }
 }
 function schedule(){if(!pending)pending=requestAnimationFrame(update);}
 function measure(){
  viewportHeight=innerHeight;
  maxScroll=Math.max(0,document.documentElement.scrollHeight-viewportHeight);
  for(const image of images){
   if(!image.naturalWidth)continue;
   // Preserve proportions, with enough vertical travel to reveal a slice at a time.
   const scale=Math.max(innerWidth/image.naturalWidth,viewportHeight*1.45/image.naturalHeight);
   const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
   image.style.width=width+'px';image.style.height=height+'px';
   sizes.set(image,{width,height});
  }
  schedule();
 }
 for(const image of images)image.addEventListener('load',measure);
 addEventListener('scroll',schedule,{passive:true});
 addEventListener('resize',measure,{passive:true});
 document.addEventListener('toggle',measure,true);
 new ResizeObserver(measure).observe(document.body);
 measure();
})();
