(function(){
'use strict';
const $=id=>document.getElementById('coord_'+id),c=$('canvas'),ctx=c.getContext('2d');
let img=null,rect=null,start=null,active=null,filename='',scale=1,loadSeq=0,labelSeq=0;
let labels=[],labelFile=null,selected=-1,overlap=[],regionSource='none';
let drawnBoxes=[],nextBoxNo=1,selectedDrawId=null,hoverDrawId=null,operation=null;
let actionTarget=null,hoverLabel=-1;
const savedRegions=new Map(),MIN_BOX=12;
function imageId(name){return cleanId(name.replace(/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i,'.txt'),true);}
function imageKey(){return img&&filename?imageId(filename)+'|'+img.naturalWidth+'x'+img.naturalHeight:'';}
function rememberImage(){const k=imageKey();if(k)savedRegions.set(k,{boxes:drawnBoxes.map(b=>({...b,rect:{...b.rect}})),nextBoxNo});}
function renumberBoxes(){
 const mapping=new Map(drawnBoxes.map((b,i)=>[b.id,i+1]));
 for(const [i,b] of drawnBoxes.entries())b.id=i+1;
 selectedDrawId=mapping.get(selectedDrawId)??null;
 hoverDrawId=mapping.get(hoverDrawId)??null;
 nextBoxNo=drawnBoxes.length+1;
 actionTarget=null;
}
function restoreImage(){const item=savedRegions.get(imageKey());drawnBoxes=item?item.boxes.map(b=>({...b,rect:{...b.rect}})):[];selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;actionTarget=null;renumberBoxes();}
function normalized(a,b){return {x1:Math.floor(Math.min(a.x,b.x)),y1:Math.floor(Math.min(a.y,b.y)),x2:Math.ceil(Math.max(a.x,b.x)),y2:Math.ceil(Math.max(a.y,b.y))};}
function pixelBox(box,width,height){
 // Exact decimal conversion of finite YOLO decimals; never clamps or edits source labels.
 const values=box.raw.split(/\s+/).slice(1).map(raw=>{const m=raw.match(/^([+-]?)(\d*\.?\d+|\d+\.)(?:[eE]([+-]?\d+))?$/);if(!m)throw Error('Tọa độ phải là số thập phân YOLO.');const digits=m[2].replace('.',''),exp=Number(m[3]||0)-(m[2].split('.')[1]||'').length;if(Math.abs(exp)>120||digits.length>240)throw Error('Độ chính xác tọa độ vượt giới hạn hiển thị.');return {n:BigInt((m[1]==='-'?'-':'')+digits),exp};});
 const scale=Math.max(0,...values.map(v=>-v.exp)),factor=10n**BigInt(scale),[x,y,w,h]=values.map(v=>v.n*10n**BigInt(v.exp+scale));
 function decimal(n){const negative=n<0n;if(negative)n=-n;const digits=(n*5n).toString().padStart(scale+2,'0');let out=digits.slice(0,-scale-1)+'.'+digits.slice(-scale-1);out=out.replace(/0+$/,'').replace(/\.$/,'');return (negative?'-':'')+out;}
 const exact=[decimal((2n*x-w)*BigInt(width)),decimal((2n*y-h)*BigInt(height)),decimal((2n*x+w)*BigInt(width)),decimal((2n*y+h)*BigInt(height))];
 return {x1:Number(exact[0]),y1:Number(exact[1]),x2:Number(exact[2]),y2:Number(exact[3]),exact};
}

function tupleFor(r,format='exact'){if(format==='integer')return `(${Math.floor(r.x1)}, ${Math.floor(r.y1)}, ${Math.ceil(r.x2)}, ${Math.ceil(r.y2)})`;return '('+(r.exact||[r.x1,r.y1,r.x2,r.y2]).join(', ')+')';}
function tuple(){return rect?tupleFor(rect,$('format').value):'';}
function dimensionCheck(r){
 const width=r?r.x2-r.x1:0,height=r?r.y2-r.y1:0;
 return {width,height,heightSmall:height<MIN_BOX};
}
function isSmall(r){return !!r&&dimensionCheck(r).heightSmall;}
function fmtPx(n){return Number(n.toFixed(5));}
function axisWarnings(r){const d=dimensionCheck(r);return d.heightSmall?[`chiều cao (dọc) ${fmtPx(d.height)} px`]:[];}
const sizePopup=$('sizeWarning');
const toastStack=document.createElement('div');
toastStack.id='coord_toastStack';document.body.append(toastStack);
toastStack.append(sizePopup,$('copyToast'));
const sizePopupText=document.createElement('span');
const sizePopupClose=document.createElement('button');
sizePopupClose.type='button';sizePopupClose.className='sizePopupClose';
sizePopupClose.setAttribute('aria-label','Đóng cảnh báo kích thước');
sizePopupClose.title='Đóng cảnh báo';
const sizePopupCount=document.createElement('span');
sizePopupCount.className='sizePopupCount';sizePopupCount.setAttribute('aria-hidden','true');
const sizePopupCross=document.createElement('span');
sizePopupCross.className='sizePopupCross';sizePopupCross.textContent='×';sizePopupCross.setAttribute('aria-hidden','true');
sizePopupClose.append(sizePopupCount,sizePopupCross);
sizePopup.append(sizePopupText,sizePopupClose);
let sizePopupTimer,lastSizeWarningKey='';
function closeSizePopup(){clearInterval(sizePopupTimer);sizePopup.hidden=true;}
sizePopupClose.onclick=closeSizePopup;
function updateSizePopup(small){
 if(!small){lastSizeWarningKey='';return;}
 if(active!==null)return;
 const key=imageKey()+'|'+selectedDrawId+'|'+tupleFor(rect);
 if(key===lastSizeWarningKey)return;
 lastSizeWarningKey=key;
 closeSizePopup();
 sizePopupText.textContent='⚠ Box đang chọn có '+axisWarnings(rect).join('; ')+' DƯỚI '+MIN_BOX+' px. Kiểm tra kích thước theo pixel ảnh gốc. Bạn vẫn có thể lưu/copy để phân xử.';
 sizePopupCount.textContent='5';
 sizePopup.hidden=false;
 const deadline=performance.now()+5000;
 sizePopupTimer=setInterval(()=>{
  const remaining=Math.ceil((deadline-performance.now())/1000);
  if(remaining<=0){closeSizePopup();return;}
  sizePopupCount.textContent=String(remaining);
 },100);
}
function hitCandidates(boxes,point,width,height){return boxes.map((b,i)=>({index:i,r:pixelBox(b,width,height)})).filter(x=>point.x>=x.r.x1&&point.x<=x.r.x2&&point.y>=x.r.y1&&point.y<=x.r.y2).sort((a,b)=>(a.r.x2-a.r.x1)*(a.r.y2-a.r.y1)-(b.r.x2-b.r.x1)*(b.r.y2-b.r.y1)||a.index-b.index).map(x=>x.index);}
function labelName(b){let names=null;try{names=currentNames();}catch{}return names?`${names[b.c]} (ID ${b.c})`:`ID ${b.c}`;}
function bounds(e){const b=c.getBoundingClientRect();return {x:Math.max(0,Math.min(img.naturalWidth,(e.clientX-b.left)*img.naturalWidth/b.width)),y:Math.max(0,Math.min(img.naturalHeight,(e.clientY-b.top)*img.naturalHeight/b.height))};}
function make(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function setOptions(){const target=$('boxSelect');target.replaceChildren();const none=make('option',null,'Chọn dòng TXT');none.value='';target.append(none);labels.forEach((b,i)=>{const op=make('option',null,`Dòng ${b.line}: ${labelName(b)}`);op.value=String(i);target.append(op);});target.value=selected<0?'':String(selected);}
function setOverlap(){const target=$('overlap');target.replaceChildren();for(const index of overlap){const b=labels[index],op=make('option',null,`Dòng ${b.line}: ${labelName(b)}`);op.value=String(index);target.append(op);}target.value=String(selected);$('overlapWrap').hidden=overlap.length<2;}
function savedBox(id){return drawnBoxes.find(b=>b.id===id)||null;}
function focusOnImage(r){if(!img)return;const stage=$('stage'),sx=c.clientWidth/img.naturalWidth,sy=c.clientHeight/img.naturalHeight;stage.scrollLeft=Math.max(0,(r.x1+r.x2)*sx/2-stage.clientWidth/2);stage.scrollTop=Math.max(0,(r.y1+r.y2)*sy/2-stage.clientHeight/2);}
function selectDraw(id,fromCanvas=false){const b=savedBox(id);if(!b)return;selected=-1;selectedDrawId=id;rect={...b.rect};regionSource=b.source;start=null;active=null;overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';$('status').textContent=`Đã chọn Box #${String(id).padStart(2,'0')}.`;redraw();if(!fromCanvas)focusOnImage(rect);}
function selectBox(index){if(!img||!Number.isInteger(index)||index<0||index>=labels.length)return;selected=index;selectedDrawId=null;rect=pixelBox(labels[index],img.naturalWidth,img.naturalHeight);regionSource='label';start=null;active=null;setToolMode('select',false);$('showBoxes').checked=true;$('boxSelect').value=String(index);if(overlap.includes(index))$('overlap').value=String(index);$('status').textContent=overlap.length>1?'Nhiều box chồng nhau. Chọn đúng số dòng TXT.':'Đã chọn box có sẵn từ TXT; không thêm vào danh sách vùng mới.';redraw();renderDrawnList();}
function hitDrawn(point){if(!img)return null;const padding=Math.max(1,5/(c.clientWidth/img.naturalWidth));const possible=drawnBoxes.filter(b=>point.x>=b.rect.x1-padding&&point.x<=b.rect.x2+padding&&point.y>=b.rect.y1-padding&&point.y<=b.rect.y2+padding);if(!possible.length)return null;possible.sort((a,b)=>{const ra=a.rect,rb=b.rect,area=(ra.x2-ra.x1)*(ra.y2-ra.y1)-(rb.x2-rb.x1)*(rb.y2-rb.y1);return area||b.id-a.id;});return possible[0];}
function renderDrawnList(){
 $('boxCount').textContent=`(${drawnBoxes.length} vùng)`;
 for(const name of ['copyAll','deleteAll'])$(name).disabled=!drawnBoxes.length;
}
function toolbarInfo(){
 if(!img||active!==null)return null;
 const hover=savedBox(hoverDrawId), chosen=savedBox(selectedDrawId);
 if(hover)return {kind:'draw',box:hover,r:hover.rect};
 if(hoverLabel>=0&&labels[hoverLabel])return {kind:'label',index:hoverLabel,r:pixelBox(labels[hoverLabel],img.naturalWidth,img.naturalHeight)};
 if(chosen)return {kind:'draw',box:chosen,r:chosen.rect};
 if(selected>=0)return {kind:'label',index:selected,r:pixelBox(labels[selected],img.naturalWidth,img.naturalHeight)};
 return null;
}
function syncToolbar(){
 const el=$('boxActions'),info=toolbarInfo();actionTarget=info;
 if(!info){el.hidden=true;return;}
 el.hidden=false;
 $('actionBoxLabel').textContent=info.kind==='draw'?`#${String(info.box.id).padStart(2,'0')}`:`TXT ${labels[info.index].line}`;
 $('actionDelete').hidden=info.kind!=='draw';
 // Locate controls in the same CSS coordinate space as the canvas, including at zoom 400%.
 el.style.visibility='hidden';
 const sx=c.clientWidth/img.naturalWidth,sy=c.clientHeight/img.naturalHeight;
 const w=el.offsetWidth,h=el.offsetHeight,pad=5;
 const r=info.r;
 const center=(r.x1+r.x2)*sx/2;
 const left=Math.max(pad,Math.min(Math.max(pad,c.clientWidth-w-pad),center-w/2));
 let top=r.y1*sy-h-9;
 if(top<pad)top=r.y2*sy+8;
 top=Math.max(pad,Math.min(Math.max(pad,c.clientHeight-h-pad),top));
 // Neu menu nam duoi box, cho vung hover vo hinh mo ve phia tren; nguoc lai mo xuong box.
 // Vung nao cung co do chong len box de chuot khong bi mat hover trong gap.
 el.dataset.bridge=top>=r.y2*sy?'above':'below';
 el.style.left=`${left}px`;el.style.top=`${top}px`;el.style.visibility='visible';
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function resizeEdges(point,r){
 if(!img)return '';
 const px=8/(c.clientWidth/img.naturalWidth),py=8/(c.clientHeight/img.naturalHeight);
 if(point.x<r.x1-px||point.x>r.x2+px||point.y<r.y1-py||point.y>r.y2+py)return '';
 // Limit edge selection to the nearest edge, including corners.
 let dx1=Math.abs(point.x-r.x1),dx2=Math.abs(point.x-r.x2),dy1=Math.abs(point.y-r.y1),dy2=Math.abs(point.y-r.y2);
 let x=dx1<=px||dx2<=px?(dx1<=dx2?'left':'right'):'';
 let y=dy1<=py||dy2<=py?(dy1<=dy2?'top':'bottom'):'';
 return x+(x&&y?'-':'')+y;
}
function cursorForEdge(edge){
 if(edge==='left'||edge==='right')return 'ew-resize';
 if(edge==='top'||edge==='bottom')return 'ns-resize';
 if(edge==='left-top'||edge==='right-bottom')return 'nwse-resize';
 if(edge==='right-top'||edge==='left-bottom')return 'nesw-resize';
 return 'move';
}
function applyDrag(point){
 if(!operation||operation.kind==='draw'||!img)return;
 const b=savedBox(operation.id);if(!b)return;
 const orig=operation.orig,r={...orig},W=img.naturalWidth,H=img.naturalHeight;
 if(operation.kind==='move'){
  const dx=Math.round(point.x-operation.origin.x),dy=Math.round(point.y-operation.origin.y);
  const shiftX=clamp(dx,-orig.x1,W-orig.x2),shiftY=clamp(dy,-orig.y1,H-orig.y2);
  r.x1+=shiftX;r.x2+=shiftX;r.y1+=shiftY;r.y2+=shiftY;
 }else{
  const edge=operation.edge;
  if(edge.includes('left'))r.x1=clamp(Math.round(point.x),0,r.x2-1);
  if(edge.includes('right'))r.x2=clamp(Math.round(point.x),r.x1+1,W);
  if(edge.includes('top'))r.y1=clamp(Math.round(point.y),0,r.y2-1);
  if(edge.includes('bottom'))r.y2=clamp(Math.round(point.y),r.y1+1,H);
 }
 b.rect=r;rect={...r};regionSource=b.source;
 operation.changed=Object.keys(r).some(k=>Math.abs(r[k]-orig[k])>.00001);
}
function overlappingDrawnBox(r,ignoreId=null){
 // Chỉ xét các vùng tím do người dùng tự khoanh/nhập; box TXT hiện hữu không bị chặn.
 // Phải có diện tích giao > 0; tiếp xúc ở cạnh/góc không tính là chồng lấn.
 return drawnBoxes.find(b=>b.id!==ignoreId&&Math.min(r.x2,b.rect.x2)>Math.max(r.x1,b.rect.x1)&&Math.min(r.y2,b.rect.y2)>Math.max(r.y1,b.rect.y1))||null;
}
function addDrawnBox(r,source){
 if(!(img&&r&&r.x2>r.x1&&r.y2>r.y1))return false;
 const conflict=overlappingDrawnBox(r);
 if(conflict){
  if(source==='draw'){rect=null;regionSource='none';redraw();}
  $('status').textContent=`⚠ Không thêm ${tupleFor(r)}: giao nhau với Box tím #${String(conflict.id).padStart(2,'0')} ${tupleFor(conflict.rect)}.`;
  return false;
 }
 const b={id:nextBoxNo++,rect:{x1:r.x1,y1:r.y1,x2:r.x2,y2:r.y2},source};
 drawnBoxes.push(b);rememberImage();selectDraw(b.id,false);renderDrawnList();
 $('status').textContent=`Đã vẽ Box #${String(b.id).padStart(2,'0')} ${tuple()}; nút sao chép và Xóa hiện ngay trên ảnh${isSmall(b.rect)?' — ⚠ '+axisWarnings(b.rect).join('; '):''}.`;
 return true;
}
function clear(){if(operation?.kind==='pan')c.style.cursor='grab';if(active!==null&&c.hasPointerCapture(active))c.releasePointerCapture(active);rect=null;selected=-1;selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;operation=null;regionSource='none';start=null;active=null;overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';$('fallback').hidden=true;$('status').textContent='';redraw();renderDrawnList();}
function syncSourcePicks(){
 const imagePick=document.getElementById('coord_imagePick');
 const labelPick=document.getElementById('coord_labelPick');
 imagePick.textContent=img?'Ảnh khác':'Chọn ảnh gốc';
 imagePick.classList.toggle('isLoadedFile',!!img);
 labelPick.textContent=labelFile?'Chọn nhãn .txt khác':'Chọn nhãn .txt của ảnh';
 labelPick.classList.toggle('isLoadedFile',!!labelFile);
}
function resetLabels(){labels=[];labelFile=null;selected=-1;hoverDrawId=null;hoverLabel=-1;if(regionSource==='label'){rect=null;regionSource='none';}overlap=[];$('overlapWrap').hidden=true;$('labelMeta').textContent='Chưa có nhãn cho ảnh này';syncSourcePicks();setOptions();redraw();renderDrawnList();}
function attachLabels(file){const boxes=parseLabels(file,false);hoverDrawId=null;hoverLabel=-1;if(img&&imageId(file.name)!==imageId(filename))throw Error('Tên nhãn không khớp ảnh: '+file.name+' / '+filename+'. Chọn đúng nhãn; hậu tố .rf được nhận diện tự động.');boxes.forEach(b=>pixelBox(b,1,1));labelFile=file;labels=boxes;selected=-1;selectedDrawId=null;regionSource='none';rect=null;overlap=[];$('overlapWrap').hidden=true;$('labelMeta').textContent=`${file.name}: ${labels.length} box. Số trên ảnh là số dòng trong TXT.`;syncSourcePicks();$('showBoxes').checked=true;setOptions();redraw();renderDrawnList();$('status').textContent=img?(labels.length?'Có thể bấm box TXT hoặc khoanh thêm nhiều vùng khác.':'Nhãn rỗng: chọn Khoanh tay vùng mới.'):'Đã đọc nhãn. Chọn ảnh gốc cùng ID để hiển thị.';}
function useLoaded(side,silent=false){try{if(!img){if(!silent)$('status').textContent='Chọn ảnh gốc trước.';return false;}const map=nameMap(state[side]),f=map.get(imageId(filename));if(!f){if(!silent)$('status').textContent='Không có nhãn cùng ID trong bộ '+(side==='before'?'ban đầu':'sau sửa')+'. Có thể chọn file TXT riêng.';return false;}labelSeq++;attachLabels(f);return true;}catch(e){if(!silent)$('status').textContent=e.message;return false;}}
function drawTag(text,x,y,color,dpr){ctx.save();const font=Math.max(10,11*dpr);ctx.font=`600 ${font}px Arial`;const pad=5*dpr,tagW=Math.min(c.width-4*dpr,ctx.measureText(text).width+2*pad),tagH=font+9*dpr;if(tagW<=0){ctx.restore();return;}const bx=Math.max(2*dpr,Math.min(c.width-tagW-2*dpr,x)),by=Math.max(2*dpr,Math.min(c.height-tagH-2*dpr,y-tagH-3*dpr));ctx.fillStyle=color;ctx.fillRect(bx,by,tagW,tagH);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(text,bx+pad,by+tagH/2,Math.max(1,tagW-2*pad));ctx.restore();}
/* Bat dock chi khi chon box va con trong khu vuc 05. Khong chup scroll neu nguoi dung ra khoi khu vuc. */
let coordDockScheduled=false;
let coordCanvasEngaged=false;
window.YoloCoordsCanvasEngaged=()=>coordCanvasEngaged;
document.getElementById('coord_stage').addEventListener('pointerdown',(event)=>{
 if(event.target.closest('#coord_canvasWrap')&&!event.target.closest('#coord_boxActions')){
   coordCanvasEngaged=true;
   coordScheduleDock();
   window.dispatchEvent(new Event('coord-dock-update'));
 }
},{capture:true});
function coordUpdateDock(){
 const shell=document.getElementById('coord_stageShell');
 const floating=document.getElementById('coord_floatingTools');
 const section=document.getElementById('coordsSection');
 if(!shell||!floating||!section)return;
 const r=section.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight;
 const fullscreen=shell.classList.contains('coordExpanded');
 const sectionVisible=fullscreen||(r.bottom>75&&r.top<vh-75);
 const hasSelected=!!(img&&rect&&(selected>=0||selectedDrawId!==null));
 const enabled=!!(img&&sectionVisible&&(fullscreen||hasSelected||coordCanvasEngaged));
 const wasDocked=floating.classList.contains('isDocked');
 const previousOffscreen=floating.classList.contains('coordMobileOffscreen');
 const usesFloatingRail=window.matchMedia('(width < 1160px)').matches;
 const offscreen=usesFloatingRail&&(!enabled||floating.hidden);
 floating.classList.toggle('isDocked',enabled);
 floating.classList.toggle('coordMobileOffscreen',offscreen);
 section.classList.toggle('coordDockInView',enabled||(usesFloatingRail&&sectionVisible&&!floating.hidden));
 if(wasDocked&&!enabled&&document.getElementById('coord_moreMenu')?.hidden===false)setMoreOpen(false);
 // On-canvas tags are painted in canvas, so update them once when dock visibility changes.
 if((wasDocked!==enabled||previousOffscreen!==offscreen)&&window.YoloCoords?.refresh){
   requestAnimationFrame(()=>window.YoloCoords?.refresh());
 }
}
function coordScheduleDock(){
 if(coordDockScheduled)return;
 coordDockScheduled=true;
 requestAnimationFrame(()=>{coordDockScheduled=false;coordUpdateDock();});
}
window.addEventListener('scroll',coordScheduleDock,{passive:true});
window.addEventListener('resize',coordScheduleDock,{passive:true});
function redraw(){
 coordUpdateDock();
 const valid=!!(img&&rect&&rect.x2>rect.x1&&rect.y2>rect.y1),small=!!(img&&rect&&(regionSource==='draw'||regionSource==='input')&&isSmall(rect));
 updateSizePopup(small);
 $('applyNote').disabled=!valid;$('boxSelect').disabled=!img||!labels.length;$('showBoxes').disabled=!labels.length;
 
 $('selectedName').textContent=selected>=0?`Box TXT dòng ${labels[selected].line}`:selectedDrawId!==null?`Box #${String(selectedDrawId).padStart(2,'0')} đang chọn`:operation?.kind==='draw'?'Đang khoanh vùng mới':'Chưa chọn box';
 $('coord').textContent=valid?tuple():'—';$('details').textContent=valid?`Rộng ${Number((rect.x2-rect.x1).toFixed(6))} px; cao ${Number((rect.y2-rect.y1).toFixed(6))} px`:'';
  $('raw').textContent=selected>=0?'Nhãn YOLO: '+labels[selected].raw:'';
 const outside=selected>=0&&rect&&(rect.x1<0||rect.y1<0||rect.x2>img.naturalWidth||rect.y2>img.naturalHeight);$('overflow').hidden=!outside;$('overflow').textContent=outside?'Box gốc có phần vượt ảnh. Giữ nguyên tọa độ từ TXT; không tự cắt biên.':'';
 if(!img){syncToolbar();return;}
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
 const sx=c.width/img.naturalWidth,sy=c.height/img.naturalHeight,dpr=window.devicePixelRatio||1;
 const dockUI=document.getElementById('coord_floatingTools');
 const suppressBoxText=!!(dockUI?.classList.contains('isDocked') && !dockUI?.classList.contains('coordMobileOffscreen') && !dockUI?.classList.contains('coordMobileCollapsed'));
 if($('showBoxes').checked)labels.forEach((box,index)=>{const r=pixelBox(box,img.naturalWidth,img.naturalHeight);ctx.strokeStyle=index===selected?'#d07400':'#164acb';ctx.lineWidth=(index===selected?3:1)*dpr;ctx.strokeRect(r.x1*sx,r.y1*sy,(r.x2-r.x1)*sx,(r.y2-r.y1)*sy);if($('showNumbers').checked&&!suppressBoxText){drawTag('TXT '+box.line,r.x1*sx,r.y1*sy,index===selected?'#a65b00':'#1246b4',dpr);}});
 for(const b of drawnBoxes){const r=b.rect,chosen=b.id===selectedDrawId,warn=isSmall(r),clr=chosen?'#7545cf':warn?'#b93422':b.source==='input'?'#7346ae':'#087b72';ctx.lineWidth=(chosen?3.5:2)*dpr;ctx.strokeStyle=clr;ctx.fillStyle=chosen?'rgba(114,65,220,.16)':'rgba(0,110,103,.045)';ctx.fillRect(r.x1*sx,r.y1*sy,(r.x2-r.x1)*sx,(r.y2-r.y1)*sy);ctx.strokeRect(r.x1*sx,r.y1*sy,(r.x2-r.x1)*sx,(r.y2-r.y1)*sy);if(chosen){ctx.strokeStyle='#fff';ctx.lineWidth=1*dpr;ctx.strokeRect((r.x1-1)*sx,(r.y1-1)*sy,(r.x2-r.x1+2)*sx,(r.y2-r.y1+2)*sy);}if($('showRegionLabels').checked&&!suppressBoxText)drawTag(`${warn?'⚠ ':''}#${String(b.id).padStart(2,'0')} ${tupleFor(r,$('format').value)}`,r.x1*sx,r.y1*sy,clr,dpr);}
 if(active!==null&&rect){const r=rect,clr=isSmall(r)?'#b93422':'#00826e';ctx.lineWidth=2*dpr;ctx.strokeStyle=clr;ctx.fillStyle='rgba(0,150,125,.15)';ctx.fillRect(r.x1*sx,r.y1*sy,(r.x2-r.x1)*sx,(r.y2-r.y1)*sy);ctx.strokeRect(r.x1*sx,r.y1*sy,(r.x2-r.x1)*sx,(r.y2-r.y1)*sy);drawTag(`${operation?.kind==='draw'?'Đang vẽ':'Đang chỉnh'} ${tupleFor(r,'integer')} | RỘNG ${fmtPx(r.x2-r.x1)}px | CAO ${fmtPx(r.y2-r.y1)}px ${r.y2-r.y1<MIN_BOX?'⚠':''}`,r.x1*sx,r.y1*sy,clr,dpr);}
 syncToolbar();
}
function layout(){if(!img)return;const stage=$('stage'),fullscreen=$('stageShell').classList.contains('coordExpanded');
 const widthScale=Math.max(1,stage.clientWidth-2)/img.naturalWidth;
 const fitScale=fullscreen?Math.min(widthScale,Math.max(1,stage.clientHeight-2)/img.naturalHeight):Math.min(1,widthScale);
 scale=$('zoom').value==='fit'?fitScale:Number($('zoom').value);const w=img.naturalWidth*scale,h=img.naturalHeight*scale,dpr=window.devicePixelRatio||1;$('canvasWrap').style.width=w+'px';$('canvasWrap').style.height=h+'px';c.style.width=w+'px';c.style.height=h+'px';c.width=Math.max(1,Math.round(w*dpr));c.height=Math.max(1,Math.round(h*dpr));redraw();}
$('file').addEventListener('change',()=>{coordCanvasEngaged=false;const file=$('file').files[0];if(!file)return;const seq=++loadSeq,url=URL.createObjectURL(file),next=new Image();next.onload=()=>{URL.revokeObjectURL(url);if(seq!==loadSeq)return;rememberImage();img=next;filename=file.name;restoreImage();clear();if(labelFile&&imageId(labelFile.name)!==imageId(filename))resetLabels();$('empty').hidden=true;$('canvasWrap').hidden=false;c.hidden=false;$('toolSelect').disabled=false;$('toolDraw').disabled=false;$('workspace').hidden=false;document.getElementById('coord_floatingTools').hidden=false;document.getElementById('coord_stageShell').classList.add('has-image');document.querySelector('.coordExtras').hidden=false;$('meta').textContent=`${filename}; ${img.naturalWidth} × ${img.naturalHeight} px`;syncSourcePicks();$('fallback').hidden=true;if(!labelFile)useLoaded('before',true);setOptions();layout();renderDrawnList();$('status').textContent=`Đã mở ảnh. Có ${drawnBoxes.length} box đã khoanh/nhập trên ảnh này.`;};next.onerror=()=>{URL.revokeObjectURL(url);if(seq===loadSeq)$('status').textContent='Không mở được ảnh. Chọn JPG/PNG hợp lệ.';};next.src=url;});
$('labelFile').addEventListener('change',async()=>{const file=$('labelFile').files[0];if(!file)return;const seq=++labelSeq;try{const text=await file.text();if(seq!==labelSeq)return;attachLabels({name:file.name,path:file.name,text});}catch(e){if(seq!==labelSeq)return;resetLabels();$('status').textContent=e.message;}});
$('useBefore').onclick=()=>useLoaded('before');$('useAfter').onclick=()=>useLoaded('after');
$('boxSelect').onchange=()=>{if($('boxSelect').value===''){clear();return;}overlap=[];$('overlapWrap').hidden=true;selectBox(Number($('boxSelect').value));};$('overlap').onchange=()=>selectBox(Number($('overlap').value));
function syncToolButtons(){
 const isSelect=$('mode').value==='select';
 for(const [name,on] of [['toolSelect',isSelect],['toolDraw',!isSelect]]){
  $(name).classList.toggle('is-active',on);
  $(name).setAttribute('aria-pressed',String(on));
 }
}
function setToolMode(value,shouldClear=true){
 if(value!=='select'&&value!=='draw')return;
 if(!img&&shouldClear){$('status').textContent='Chọn ảnh gốc trước khi sử dụng công cụ bàn tay hoặc bút vẽ.';return;}
 const changed=$('mode').value!==value;
 $('mode').value=value;syncToolButtons();
 if(changed&&shouldClear){clear();$('status').textContent=value==='select'?'Đã bật bàn tay. Kéo ngoài box để di chuyển ảnh, kéo box tự vẽ để chỉnh box.':'Đã bật bút vẽ: kéo chuột để khoanh box mới; các box cũ vẫn được giữ.';}
 c.style.cursor=value==='select'?'grab':'crosshair';
 if(changed)$('mode').dispatchEvent(new Event('change',{bubbles:true}));
}
$('toolSelect').onclick=()=>setToolMode('select');
$('toolDraw').onclick=()=>setToolMode('draw');
document.addEventListener('keydown',e=>{
 if(e.altKey||e.metaKey||e.ctrlKey||e.repeat||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(['v','d'].includes(e.key.toLowerCase()))setToolMode('select');
 if(e.key==='b'||e.key==='B')setToolMode('draw');
});
syncToolButtons();
$('format').onchange=()=>{redraw();renderDrawnList();};$('showBoxes').onchange=redraw;$('showNumbers').onchange=redraw;$('showRegionLabels').onchange=redraw;
for(let i=0;i<4;i++)document.getElementById('class'+i).addEventListener('input',()=>{setOptions();redraw();});
c.addEventListener('pointerdown',e=>{
 if(!img||e.button!==0||active!==null)return;
 e.preventDefault();hoverLabel=-1;const point=bounds(e),hit=e.shiftKey?null:hitDrawn(point);
 if(hit){
  const previouslySelected=hit.id===selectedDrawId;
  hoverDrawId=hit.id;selectDraw(hit.id,true);
  const edge=previouslySelected?resizeEdges(point,hit.rect):'';
  active=e.pointerId;c.setPointerCapture(active);
  operation={kind:edge?'resize':'move',id:hit.id,edge,origin:point,orig:{...hit.rect},changed:false};
  redraw();return;
 }
 if($('mode').value==='select'){
  hoverDrawId=null;hoverLabel=-1;
  overlap=$('showBoxes').checked?hitCandidates(labels,point,img.naturalWidth,img.naturalHeight):[];
  if(overlap.length){selectBox(overlap[0]);setOverlap();return;}
  clear();
  const stage=$('stage');
  operation={kind:'pan',x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};
  active=e.pointerId;c.setPointerCapture(active);
  c.style.cursor='grabbing';
  return;
 }
 selected=-1;selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;regionSource='draw';overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';
 active=e.pointerId;c.setPointerCapture(active);start=point;operation={kind:'draw'};rect=normalized(start,start);
 $('status').textContent='Đang khoanh box mới; thả chuột để lưu. Chỉ cảnh báo khi chiều cao dưới 12 px.';redraw();
});
function panImage(e){
 const stage=$('stage');
 stage.scrollLeft=operation.left+operation.x-e.clientX;
 stage.scrollTop=operation.top+operation.y-e.clientY;
}
c.addEventListener('pointermove',e=>{
 if(!img)return;
 if(operation?.kind==='pan'){
  if(active===e.pointerId)panImage(e);
  return;
 }
 const point=bounds(e);
 if(active===e.pointerId){
  if(operation?.kind==='draw'&&start)rect=normalized(start,point);
  else applyDrag(point);
  redraw();return;
 }
 const hit=hitDrawn(point),nextHover=hit?.id||null;
 const nextLabel=!hit&&e.pointerType!=='touch'&&$('mode').value==='select'&&$('showBoxes').checked
   ? hitCandidates(labels,point,img.naturalWidth,img.naturalHeight)[0]??-1 : -1;
 if(hoverDrawId!==nextHover||hoverLabel!==nextLabel){hoverDrawId=nextHover;hoverLabel=nextLabel;syncToolbar();}
 if(hit){const edge=hit.id===selectedDrawId?resizeEdges(point,hit.rect):'';c.style.cursor=edge?cursorForEdge(edge):'move';}
 else c.style.cursor=$('mode').value==='select'?(nextLabel>=0?'pointer':'grab'):'crosshair';
});
c.addEventListener('pointerleave',e=>{if(e.relatedTarget===$('boxActions')||$('boxActions').contains(e.relatedTarget))return;if(active===null){hoverDrawId=null;hoverLabel=-1;syncToolbar();}});
$('boxActions').addEventListener('pointerleave',e=>{
 if(e.relatedTarget===c)return;
 hoverDrawId=null;hoverLabel=-1;syncToolbar();
});
function end(e){
 if(active!==e.pointerId)return;
 const op=operation;
 if(op?.kind==='pan'){
  if(e.type==='pointerup')panImage(e);
  active=null;operation=null;
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  c.style.cursor='grab';
  return;
 }
 const point=img?bounds(e):null;
 if(e.type==='pointerup'&&op?.kind==='draw'&&start){const fresh=normalized(start,point);start=null;active=null;operation=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  if(fresh.x2>fresh.x1&&fresh.y2>fresh.y1){addDrawnBox(fresh,'draw');}else{rect=null;regionSource='none';$('status').textContent='Vùng có chiều rộng hoặc cao bằng 0 px, chưa lưu.';redraw();}
  return;
 }
 if(op&&(op.kind==='move'||op.kind==='resize')){
  if(e.type==='pointercancel'){const b=savedBox(op.id);if(b)b.rect={...op.orig};}
  else applyDrag(point);
  const b=savedBox(op.id);if(b){rect={...b.rect};regionSource=b.source;rememberImage();}
  const what=op.kind==='move'?'di chuyển':'đổi kích thước';
  $('status').textContent=op.changed&&b?`Đã ${what} Box #${String(b.id).padStart(2,'0')} → ${tupleFor(b.rect,$('format').value)}${isSmall(b.rect)?' · ⚠ '+axisWarnings(b.rect).join('; '):''}.`:`Đã chọn Box #${String(op.id).padStart(2,'0')}.`;
 }
 start=null;active=null;operation=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);redraw();renderDrawnList();
}
c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
c.addEventListener('lostpointercapture',e=>{if(operation?.kind==='pan')end(e);});
// Nhấn vùng trống trên trang để bỏ chọn, trừ nút nổi và các điều khiển phải giữ box để thao tác.
document.addEventListener('click',e=>{
 if(!rect||active!==null||e.target===c)return;
 if(e.target.closest('#coord_boxActions, #coord_floatingTools, #coord_overlapWrap, #coord_boxSelect, #coord_applyNote, #coord_format, .coordZoomControl'))return;
 clear();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('stageShell').classList.contains('coordExpanded')&&(!e.target.closest('input,textarea,select')||e.target===c))clear();});
function syncZoomButtons(){document.querySelectorAll('[data-coord-zoom]').forEach(btn=>{const on=btn.dataset.coordZoom===$('zoom').value;btn.classList.toggle('is-active',on);btn.setAttribute('aria-pressed',String(on));});}
const zoomSelect=$('zoom');
function setZoom(value){
 if(zoomSelect.value===value)return;
 zoomSelect.value=value;
 zoomSelect.dispatchEvent(new Event('change',{bubbles:true}));
}
document.querySelectorAll('[data-coord-zoom]').forEach(btn=>btn.addEventListener('click',()=>setZoom(btn.dataset.coordZoom)));
zoomSelect.onchange=()=>{syncZoomButtons();layout();};syncZoomButtons();
document.addEventListener('keydown',e=>{
 if(!img||e.altKey||!(e.ctrlKey||e.metaKey)||e.target.closest('input:not([type="range"]),textarea,[contenteditable="true"]'))return;
 const zoomIn=e.key==='+'||e.key==='='||e.code==='NumpadAdd';
 const zoomOut=e.key==='-'||e.key==='−'||e.code==='NumpadSubtract';
 if(!zoomIn&&!zoomOut)return;
 const stage=$('stage').getBoundingClientRect();
 if(stage.bottom<=0||stage.top>=window.innerHeight)return;
 e.preventDefault();
 const levels=Array.from(zoomSelect.options).slice(1);
 const next=zoomIn
  ? levels.find(option=>Number(option.value)>scale)
  : levels.reverse().find(option=>Number(option.value)<scale);
 if(next)setZoom(next.value);
 else if(zoomOut&&zoomSelect.value!=='fit')setZoom('fit');
});
window.addEventListener('resize',()=>{if($('zoom').value==='fit')layout();});
function setInputFeedback(message,error=false){$('inputFeedback').textContent=message;$('inputFeedback').classList.toggle('error',error);}
function parsedCoord(raw){
 const clean=raw.trim().replace(/^region_xyxy\s*:\s*/i,'').replace(/^\s*[([{]\s*/,'').replace(/\s*[)\]}]\s*$/,'');
 const parts=clean.split(/[;,\s]+/).filter(Boolean);
 if(parts.length!==4||parts.some(x=>!/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(x)))throw Error('Cần đủ 4 số theo thứ tự xmin, ymin, xmax, ymax; dùng dấu chấm thập phân.');
 return parts.map(Number);
}
function parsedCoordBatch(raw){
 // Cho phép nhiều tuple trên một dòng hoặc nhiều dòng, có/không có #01 trước mỗi tuple.
 const num='([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
 const pattern=new RegExp('\\(\\s*'+num+'\\s*[,;\\s]+\\s*'+num+'\\s*[,;\\s]+\\s*'+num+'\\s*[,;\\s]+\\s*'+num+'\\s*\\)','g');
 const matches=[...raw.matchAll(pattern)];
 if(!matches.length)return [parsedCoord(raw)];
 const leftovers=raw.replace(pattern,' ').replace(/#\d+\s*/g,' ').replace(/\bregion_xyxy\s*:/gi,' ').replace(/[\s,;]+/g,'').trim();
 if(leftovers)throw Error('Có ký tự hoặc tọa độ không đúng định dạng. Dán các nhóm (xmin, ymin, xmax, ymax), có thể kèm #01, #02...');
 return matches.map(m=>m.slice(1,5).map(Number));
}
function drawTypedBox(){
 try{
  if(!img)throw Error('Chọn ảnh gốc trước khi tạo box.');
  const raw=$('quick').value.trim();
  if(!raw)throw Error('Dán ít nhất một bộ tọa độ trước khi bấm dấu +.');
  const batches=parsedCoordBatch(raw);
  const W=img.naturalWidth,H=img.naturalHeight,added=[],overlaps=[],invalid=[],heightWarnings=[];
  if(active!==null&&c.hasPointerCapture(active))c.releasePointerCapture(active);
  for(let i=0;i<batches.length;i++){
   const coords=batches[i],[x1,y1,x2,y2]=coords,r={x1,y1,x2,y2},order=i+1;
   if(!coords.every(Number.isFinite)||x1<0||y1<0||x2>W||y2>H||x1>=x2||y1>=y2){
    invalid.push(`${order}: ${tupleFor(r)} (sai thứ tự hoặc vượt ảnh ${W}×${H})`);continue;
   }
   const conflict=overlappingDrawnBox(r);
   if(conflict){overlaps.push(`${order} → #${String(conflict.id).padStart(2,'0')}`);continue;}
   if(addDrawnBox(r,'input')){
    added.push({number:order,boxId:selectedDrawId,rect:r});
    if(isSmall(r))heightWarnings.push(String(order));
   }
  }
  if(added.length){
   focusOnImage(added[0].rect);
  }
  if(invalid.length===0)$('quick').value='';
  const parts=[`Đã thêm ${added.length}/${batches.length} box màu tím.`];
  if(overlaps.length)parts.push(`Bỏ qua ${overlaps.length} box trùng/chồng lấn (mục dán → box đã có): ${overlaps.join(', ')}.`);
  if(invalid.length)parts.push(`Bỏ qua ${invalid.length} tọa độ không hợp lệ: ${invalid.join('; ')}.`);
  if(heightWarnings.length)parts.push(`⚠ Chiều cao < 12 px tại mục: ${heightWarnings.join(', ')} (vẫn được tạo để rà soát).`);
  const summary=parts.join(' ');
  setInputFeedback(summary,!!(overlaps.length||invalid.length));
  $('status').textContent=summary;
 }catch(err){setInputFeedback(err.message,true);$('status').textContent='Không tạo box: '+err.message;}
}
$('makeBox').onclick=drawTypedBox;
$('quick').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();drawTypedBox();}});
const copyFlashTimers=new WeakMap;
let copyToastTimer=null;
const copyPopupClose=sizePopupClose.cloneNode(true);
copyPopupClose.setAttribute('aria-label','Đóng thông báo sao chép');copyPopupClose.title='Đóng thông báo';
$('copyToast').append(copyPopupClose);
copyPopupClose.onclick=()=>{clearInterval(copyToastTimer);$('copyToast').hidden=true;};
// Action feedback uses its own popup so copy and size notices can coexist.
const actionToast=$('copyToast').cloneNode(true);
actionToast.id='coord_actionToast';actionToast.hidden=true;
const actionToastText=actionToast.querySelector('#coord_copyToastText');
actionToastText.id='coord_actionToastText';
const actionPopupClose=actionToast.querySelector('.sizePopupClose');
actionPopupClose.setAttribute('aria-label','Đóng thông báo thao tác');
toastStack.append(actionToast);
let actionToastTimer=null;
function closeActionPopup(){clearInterval(actionToastTimer);actionToast.hidden=true;}
actionPopupClose.onclick=closeActionPopup;
function showActionFeedback(message){
 clearInterval(actionToastTimer);
 actionToastText.textContent=message;
 actionPopupClose.querySelector('.sizePopupCount').textContent='5';
 actionToast.hidden=false;
 const deadline=performance.now()+5000;
 actionToastTimer=setInterval(()=>{
  const remaining=Math.ceil((deadline-performance.now())/1000);
  if(remaining<=0){closeActionPopup();return;}
  actionPopupClose.querySelector('.sizePopupCount').textContent=String(remaining);
 },100);
}
// Route every coordinate-tool status through the same timed popup.
// This hidden node remains an event sink for existing action handlers only;
// clear it after delivery so a menu or collapsed toolbar cannot reveal stale text.
const statusSink=$('status');
function deliverStatusPopup(){
 const message=statusSink.textContent.trim();
 if(!message)return;
 statusSink.textContent='';
 // Clipboard actions already own a separate popup, including failure feedback.
 if(message==='✓ Đã sao chép vào bộ nhớ tạm.'||message.startsWith('Không thể tự động sao chép.'))return;
 showActionFeedback(message);
}
const statusPopupObserver=new MutationObserver(deliverStatusPopup);
statusPopupObserver.observe(statusSink,{childList:true,characterData:true,subtree:true});
deliverStatusPopup();
function showCopyFeedback(ok,button){
 const toast=$('copyToast'),label=$('copyToastText');
 clearInterval(copyToastTimer);
 toast.hidden=false;toast.classList.toggle('copyFailed',!ok);
 label.textContent=ok?'Đã sao chép vào bộ nhớ tạm':'Chưa sao chép được — dùng Cmd+C / Ctrl+C';
 copyPopupClose.querySelector('.sizePopupCount').textContent='5';
 const copyDeadline=performance.now()+5000;
 copyToastTimer=setInterval(()=>{
  const remaining=Math.ceil((copyDeadline-performance.now())/1000);
  if(remaining<=0){clearInterval(copyToastTimer);toast.hidden=true;return;}
  copyPopupClose.querySelector('.sizePopupCount').textContent=String(remaining);
 },100);
 if(!button)return;
 const priorTimer=copyFlashTimers.get(button);
 if(priorTimer)clearTimeout(priorTimer);
 if(!button.dataset.originalCopyLabel)button.dataset.originalCopyLabel=button.textContent;
 button.textContent=ok?'✓ Đã chép':'! Chép thủ công';
 button.classList.toggle('copySuccess',ok);
 button.classList.toggle('copyFailure',!ok);
 copyFlashTimers.set(button,setTimeout(()=>{
   button.textContent=button.dataset.originalCopyLabel;
   button.classList.remove('copySuccess','copyFailure');
   copyFlashTimers.delete(button);
 },2000));
}
async function copy(text,button){
 let success=false;
 // Do not mark copied unless the browser confirms a write succeeded.
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);success=true;}}catch(_){}
 if(!success){
   const area=$('fallback');area.hidden=false;area.value=text;area.focus();area.select();
   try{success=!!document.execCommand('copy');}catch(_){}
 }
 if(success){$('fallback').hidden=true;$('status').textContent='✓ Đã sao chép vào bộ nhớ tạm.';}
 else{$('fallback').hidden=false;$('fallback').value=text;$('fallback').focus();$('fallback').select();$('status').textContent='Không thể tự động sao chép. Nội dung đã được chọn; nhấn Cmd+C (Mac) hoặc Ctrl+C.';}
 showCopyFeedback(success,button);
 return success;
}
function noteFor(r,source,id=null,line=null){return `image_id: ${imageId(filename)}\n${id!==null?'box_ref: #'+String(id).padStart(2,'0')+'\n':''}region_xyxy: ${tupleFor(r,$('format').value)}\ncoordinate_source: ${source==='label'?'existing_yolo_box':source==='input'?'typed_pixel_region':'manual_region'}${line!==null?'\nlabel_line: '+labels[line].line+'\nclass_id: '+labels[line].c+'\nyolo: '+labels[line].raw:''}\nreason: `;}
function deleteBox(id){
 const b=savedBox(id);if(!b)return;
 drawnBoxes=drawnBoxes.filter(x=>x.id!==id);
 if(selectedDrawId===id){selectedDrawId=null;rect=null;regionSource='none';}
 hoverDrawId=null;hoverLabel=-1;renumberBoxes();rememberImage();
 $('status').textContent='';
 showActionFeedback(`Đã xóa Box #${String(id).padStart(2,'0')}. Đã đánh số lại ${drawnBoxes.length} box còn lại từ #01.`);
 redraw();renderDrawnList();
}
$('actionCopy').onclick=()=>{
 const t=actionTarget;if(!t)return;
 if(t.kind==='draw'){selectDraw(t.box.id,true);copy(tupleFor(t.box.rect,$('format').value),$('actionCopy'));}
 else{selectBox(t.index);copy(tupleFor(t.r,$('format').value),$('actionCopy'));}
};
$('actionNote').onclick=()=>{
 const t=actionTarget;if(!t)return;
 if(t.kind==='draw'){selectDraw(t.box.id,true);copy(noteFor(t.box.rect,t.box.source,t.box.id),$('actionNote'));}
 else{selectBox(t.index);copy(noteFor(t.r,'label',null,t.index),$('actionNote'));}
};
$('actionDelete').onclick=()=>{const t=actionTarget;if(t?.kind==='draw')deleteBox(t.box.id);};
$('copyAll').onclick=()=>{if(drawnBoxes.length)copy(drawnBoxes.map(b=>`#${String(b.id).padStart(2,'0')} ${tupleFor(b.rect,$('format').value)}${isSmall(b.rect)?' [CẢNH BÁO: '+axisWarnings(b.rect).join('; ')+ ' dưới 12 px]':''}`).join('\n'),$('copyAll'));};
// Menu thao tác bổ sung; giữ trạng thái chọn box khi tương tác thanh nổi.
const moreToggle=$('moreToggle'),moreMenu=$('moreMenu');
const fullscreenShell=$('stageShell'),fullscreenButton=$('fullscreen');
function updateFullscreen(expanded){
 fullscreenShell.classList.toggle('coordExpanded',expanded);
 fullscreenButton.textContent=expanded?'Thoát toàn màn hình':'Toàn màn hình';
 fullscreenButton.dataset.actionIcon=expanded?'coord-fullscreen-exit':'coord-fullscreen';
 layout();
}
document.addEventListener('fullscreenchange',()=>updateFullscreen(document.fullscreenElement===fullscreenShell));
fullscreenButton.addEventListener('click',async()=>{
 setMoreOpen(false);
 const menuButton=window.matchMedia('(width < 1160px)').matches?$('m_more'):moreToggle;
 menuButton?.focus({preventScroll:true});
 if(document.fullscreenElement===fullscreenShell){
  await document.exitFullscreen();
 }else if(fullscreenShell.classList.contains('coordExpanded')){
  updateFullscreen(false);
 }else{
  if(document.fullscreenEnabled&&fullscreenShell.requestFullscreen){
   try{await fullscreenShell.requestFullscreen();return;}catch(_){}
  }
  updateFullscreen(true);
 }
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!document.fullscreenElement&&fullscreenShell.classList.contains('coordExpanded'))updateFullscreen(false);
});
function setMoreOpen(open){moreMenu.hidden=!open;moreToggle.setAttribute('aria-expanded',String(open));}
moreToggle.addEventListener('click',event=>{event.stopPropagation();setMoreOpen(moreMenu.hidden);});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#coord_moreWrap'))setMoreOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMoreOpen(false);});
for(const id of ['copyAll','applyNote','deleteAll'])$(id).addEventListener('click',()=>setMoreOpen(false));

$('deleteAll').onclick=()=>{if(!drawnBoxes.length)return;if(!window.confirm(`Xóa toàn bộ ${drawnBoxes.length} box đã vẽ trên ảnh này? Việc này không sửa nhãn TXT.`))return;drawnBoxes=[];nextBoxNo=1;rememberImage();clear();$('status').textContent='';showActionFeedback('Đã xóa toàn bộ box được khoanh/nhập trên ảnh này.');};
$('applyNote').onclick=()=>{if(!rect||rect.x2<=rect.x1||rect.y2<=rect.y1)return;const context=selected>=0?`box TXT dòng ${labels[selected].line}, lớp ${labelName(labels[selected])}`:selectedDrawId!==null?`box #${String(selectedDrawId).padStart(2,'0')}, ${regionSource==='input'?'nhập tọa độ':'khoanh tay'}`:'vùng khoanh tay';const ok=applyPixelRegion(filename,tuple(),context);$('status').textContent=ok?'Đã ghi tọa độ box đang chọn vào notes đúng ảnh.':'Chưa thấy ảnh trong log. Chạy So sánh nhãn và dùng đúng ID ảnh.';};
window.YoloCoords={normalized,pixelBox,tupleFor,hitCandidates,tuple,refresh:redraw,getRegions:()=>drawnBoxes.map(b=>({...b,rect:{...b.rect}}))};redraw();renderDrawnList();
})();