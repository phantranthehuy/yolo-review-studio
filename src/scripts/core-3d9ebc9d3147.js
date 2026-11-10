(function(){
'use strict';
const $=id=>document.getElementById('coord_'+id),c=$('canvas'),ctx=c.getContext('2d');
let img=null,rect=null,start=null,active=null,filename='',scale=1,loadSeq=0,labelSeq=0;
let labels=[],beforeLabels=[],labelFile=null,selected=-1,selectedBefore=-1,hoverBefore=-1,showBefore=true,overlap=[],regionSource='none';
let drawnBoxes=[],nextBoxNo=1,selectedDrawId=null,hoverDrawId=null,operation=null;
let actionTarget=null,hoverLabel=-1;
// Bounding boxes and tags are vector shapes. A tiny canvas is kept only as the pointer/measure surface.
const SVG_NS='http://www.w3.org/2000/svg';
const vectors=document.createElementNS(SVG_NS,'svg');
vectors.id='coord_vectorOverlay';vectors.setAttribute('aria-hidden','true');
c.after(vectors);
const svgNode=(tag,props={})=>{const n=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(props))n.setAttribute(k,String(v));return n;};
let loadedAfterId='',lastCommittedA=null;
const savedRegions=new Map(),MIN_BOX=12,MAX_ZOOM=32,INVALID_BOX_REMOVE_DELAY=500;
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
function restoreImage(){cancelAllInvalidBoxRemovals();const item=savedRegions.get(imageKey());drawnBoxes=item?item.boxes.map(b=>({...b,rect:{...b.rect}})):[];selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;actionTarget=null;renumberBoxes();drawnBoxes.forEach(scheduleInvalidBoxRemoval);}
function normalized(a,b){return {x1:Math.floor(Math.min(a.x,b.x)),y1:Math.floor(Math.min(a.y,b.y)),x2:Math.ceil(Math.max(a.x,b.x)),y2:Math.ceil(Math.max(a.y,b.y))};}
const pixelRectCache=new WeakMap();
function pixelBox(box,width,height){
 const cached=pixelRectCache.get(box);
 if(cached&&cached.width===width&&cached.height===height)return cached.rect;
 // Exact decimal conversion of finite YOLO decimals; never clamps or edits source labels.
 const values=box.raw.split(/\s+/).slice(1).map(raw=>{const m=raw.match(/^([+-]?)(\d*\.?\d+|\d+\.)(?:[eE]([+-]?\d+))?$/);if(!m)throw Error('Tọa độ phải là số thập phân YOLO.');const digits=m[2].replace('.',''),exp=Number(m[3]||0)-(m[2].split('.')[1]||'').length;if(Math.abs(exp)>120||digits.length>240)throw Error('Độ chính xác tọa độ vượt giới hạn hiển thị.');return {n:BigInt((m[1]==='-'?'-':'')+digits),exp};});
 const scale=Math.max(0,...values.map(v=>-v.exp)),factor=10n**BigInt(scale),[x,y,w,h]=values.map(v=>v.n*10n**BigInt(v.exp+scale));
 function decimal(n){const negative=n<0n;if(negative)n=-n;const digits=(n*5n).toString().padStart(scale+2,'0');let out=digits.slice(0,-scale-1)+'.'+digits.slice(-scale-1);out=out.replace(/0+$/,'').replace(/\.$/,'');return (negative?'-':'')+out;}
 const exact=[decimal((2n*x-w)*BigInt(width)),decimal((2n*y-h)*BigInt(height)),decimal((2n*x+w)*BigInt(width)),decimal((2n*y+h)*BigInt(height))];
 const rect={x1:Number(exact[0]),y1:Number(exact[1]),x2:Number(exact[2]),y2:Number(exact[3]),exact};
 pixelRectCache.set(box,{width,height,rect});
 return rect;
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
// Box tự khoanh/nhập cao dưới 12px chỉ tồn tại thêm 0,5 giây để người dùng thấy lỗi.
// Dùng tham chiếu object thay vì id vì id sẽ được đánh số lại khi xóa box khác.
const invalidBoxRemovalTimers=new Map();
function cancelInvalidBoxRemoval(box){
 const timer=invalidBoxRemovalTimers.get(box);
 if(timer!==undefined){clearTimeout(timer);invalidBoxRemovalTimers.delete(box);}
}
function cancelAllInvalidBoxRemovals(){
 for(const timer of invalidBoxRemovalTimers.values())clearTimeout(timer);
 invalidBoxRemovalTimers.clear();
}
function scheduleInvalidBoxRemoval(box){
 if(!box||!isSmall(box.rect)){if(box)cancelInvalidBoxRemoval(box);return;}
 if(invalidBoxRemovalTimers.has(box))return;
 const timer=setTimeout(()=>{
  invalidBoxRemovalTimers.delete(box);
  if(!drawnBoxes.includes(box)||!isSmall(box.rect))return;
  // Không hiện thông báo xóa khác: cảnh báo kích thước vẫn đếm 5 giây như cũ.
  deleteBox(box.id,true);
 },INVALID_BOX_REMOVE_DELAY);
 invalidBoxRemovalTimers.set(box,timer);
}
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
function hitCandidates(boxes,point,width,height){
 const hits=[];
 for(let i=0;i<boxes.length;i++){
  const r=pixelBox(boxes[i],width,height);
  if(point.x>=r.x1&&point.x<=r.x2&&point.y>=r.y1&&point.y<=r.y2)
   hits.push({index:i,area:(r.x2-r.x1)*(r.y2-r.y1)});
 }
 hits.sort((a,b)=>a.area-b.area||a.index-b.index);
 return hits.map(x=>x.index);
}
function labelName(b){let names=null;try{names=currentNames();}catch{}return names?`${names[b.c]} (ID ${b.c})`:`ID ${b.c}`;}
function bounds(e){const b=c.getBoundingClientRect();return {x:Math.max(0,Math.min(img.naturalWidth,(e.clientX-b.left)*img.naturalWidth/b.width)),y:Math.max(0,Math.min(img.naturalHeight,(e.clientY-b.top)*img.naturalHeight/b.height))};}
function make(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function setOptions(){const target=$('boxSelect');target.replaceChildren();const none=make('option',null,'Chọn box A');none.value='';target.append(none);labels.forEach((b,i)=>{const op=make('option',null,`Dòng ${b.line}: ${labelName(b)}`);op.value=String(i);target.append(op);});target.value=selected<0?'':String(selected);}
function setOverlap(){const target=$('overlap');target.replaceChildren();for(const index of overlap){const b=labels[index],op=make('option',null,`Dòng ${b.line}: ${labelName(b)}`);op.value=String(index);target.append(op);}target.value=String(selected);$('overlapWrap').hidden=overlap.length<2;}
function savedBox(id){return drawnBoxes.find(b=>b.id===id)||null;}
function focusOnImage(r){if(!img)return;const stage=$('stage'),sx=c.clientWidth/img.naturalWidth,sy=c.clientHeight/img.naturalHeight;stage.scrollLeft=Math.max(0,(r.x1+r.x2)*sx/2-stage.clientWidth/2);stage.scrollTop=Math.max(0,(r.y1+r.y2)*sy/2-stage.clientHeight/2);}
function selectDraw(id,fromCanvas=false){const b=savedBox(id);if(!b)return;selected=-1;selectedBefore=-1;selectedDrawId=id;rect={...b.rect};regionSource=b.source;start=null;active=null;overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';$('status').textContent=`Đã chọn Box #${String(id).padStart(2,'0')}.`;redraw();if(!fromCanvas)focusOnImage(rect);}
function selectBox(index){if(!img||!Number.isInteger(index)||index<0||index>=labels.length)return;selectedBefore=-1;selected=index;selectedDrawId=null;rect=pixelBox(labels[index],img.naturalWidth,img.naturalHeight);regionSource='label';start=null;active=null;setToolMode('select',false);$('showBoxes').checked=true;$('boxSelect').value=String(index);if(overlap.includes(index))$('overlap').value=String(index);$('status').textContent=overlap.length>1?'Nhiều box chồng nhau. Chọn đúng số dòng TXT.':'Đã chọn box A. Kéo bên trong để di chuyển; chọn lần nữa và kéo mép/góc để chỉnh kích thước.';redraw();renderDrawnList();}
function selectBeforeBox(index){
 if(!img||index<0||index>=beforeLabels.length)return;
 selectedBefore=index;selected=-1;selectedDrawId=null;regionSource='before';
 rect=pixelBox(beforeLabels[index],img.naturalWidth,img.naturalHeight);
 $('boxSelect').value='';start=null;active=null;overlap=[];$('overlapWrap').hidden=true;
 $('status').textContent='Nhãn B ban đầu chỉ để đối chiếu. Không thể sửa tọa độ, lớp hoặc xóa tại mục 05.';
 redraw();renderDrawnList();
}
function boxRect(b,index){return operation?.kind?.startsWith('label-')&&operation.index===index&&operation.preview?operation.preview:pixelBox(b,img.naturalWidth,img.naturalHeight);}
function afterEntry(){if(!img)return null;try{return nameMap(state.after).get(imageId(filename))||null;}catch{return null;}}
function canEditAfter(){return !!(afterEntry()&&labelFile&&loadedAfterId===imageId(filename));}
function syncAfterControls(){
 const editable=canEditAfter(),selectedA=selected>=0&&editable;
 let names=CANONICAL;try{names=currentNames()||CANONICAL;}catch{}
 for(let i=0;i<4;i++)$('afterClass').options[i+1].textContent=`${i} · ${names[i]}`;
 $('afterClass').disabled=!selectedA;$('deleteAfter').disabled=!selectedA;$('exportAfter').disabled=!editable;
 $('afterClass').value=selectedA?String(labels[selected].c):'';
 $('useBefore').textContent=showBefore?'Ẩn nhãn B':'Hiện nhãn B';$('useBefore').setAttribute('aria-pressed',String(showBefore));
}
function syncBeforeOverlay(){
 if(!img){beforeLabels=[];return;}
 try{const source=nameMap(state.before).get(imageId(filename));beforeLabels=source?parseLabels(source,false):[];}
 catch(e){beforeLabels=[];$('status').textContent='Không đọc được B: '+e.message;}
}
function recordAfterEdit(nextLines,info){
 const source=afterEntry();if(!source)throw Error('Phải nạp nhãn A sau sửa vào mục 01 trước khi chỉnh.');
 const fresh=nextLines.join('\n').replace(/\n*$/,'')+'\n';
 const check=parseLabels({...source,text:fresh},false);
 // Chỉ khống chế hình học của box vừa sửa trong rewriteAfter.
 // Những box còn sai ở các dòng khác được giữ để có thể sửa lần lượt qua QC.
 lastCommittedA={imageId:imageId(filename),previous:source.text};
 const shortened=check.length<labels.length;
 source.text=fresh;labelFile=source;loadedAfterId=imageId(filename);labels=check;
 if(shortened||selected>=labels.length){selected=-1;rect=null;regionSource='none';hoverLabel=-1;overlap=[];}
 state.matchReviews.clear();invalidate();updateCounts();
 window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after',source:'coordinates'}}));
 $('labelMeta').textContent=`A · ${source.name}: ${labels.length} box · đã chỉnh trong phiên, hãy tải TXT A.`;
 setOptions();syncAfterControls();redraw();
 $('status').textContent=info+' File trên ổ đĩa chưa bị ghi đè; nhấn Tải TXT A để lưu.';
}
function rewriteAfter(index,options){
 if(!canEditAfter())throw Error('Chỉ sửa nhãn A sau sửa đã nạp tại mục 01.');
 const source=afterEntry(),old=labels[index];if(!old)throw Error('Box A không còn tồn tại.');
 const lines=source.text.replace(/^\uFEFF/,'').split(/\r?\n/);
 const line=old.line-1,parts=old.raw.split(/\s+/);
 if(options.remove){lines.splice(line,1);return recordAfterEdit(lines,`Đã xóa box A dòng ${old.line}.`);}
 if(options.classId!==undefined)parts[0]=String(options.classId);
 if(options.rect){
  const r=options.rect,W=img.naturalWidth,H=img.naturalHeight;
  if(!(r.x2>r.x1&&r.y2>r.y1&&r.x1>=0&&r.y1>=0&&r.x2<=W&&r.y2<=H))throw Error('Tọa độ box A không hợp lệ hoặc vượt ảnh.');
  const f=n=>Number(n.toFixed(10)).toString();
  parts.splice(1,4,f((r.x1+r.x2)/(2*W)),f((r.y1+r.y2)/(2*H)),f((r.x2-r.x1)/W),f((r.y2-r.y1)/H));
 }
 lines[line]=parts.join(' ');recordAfterEdit(lines,`Đã cập nhật box A dòng ${old.line}.`);
}

function hitDrawn(point){if(!img)return null;const padding=Math.max(1,5/(c.clientWidth/img.naturalWidth));const possible=drawnBoxes.filter(b=>point.x>=b.rect.x1-padding&&point.x<=b.rect.x2+padding&&point.y>=b.rect.y1-padding&&point.y<=b.rect.y2+padding);if(!possible.length)return null;possible.sort((a,b)=>{const ra=a.rect,rb=b.rect,area=(ra.x2-ra.x1)*(ra.y2-ra.y1)-(rb.x2-rb.x1)*(rb.y2-rb.y1);return area||b.id-a.id;});return possible[0];}
function renderDrawnList(){
 $('boxCount').textContent=`(${drawnBoxes.length} vùng)`;
 for(const name of ['copyAll','deleteAll'])$(name).disabled=!drawnBoxes.length;
}
function toolbarInfo(){
 if(!img||active!==null)return null;
 const hover=savedBox(hoverDrawId), chosen=savedBox(selectedDrawId);
 if(hover)return {kind:'draw',box:hover,r:hover.rect};
 if(hoverLabel>=0&&labels[hoverLabel])return {kind:'label',index:hoverLabel,r:boxRect(labels[hoverLabel],hoverLabel)};
 if(hoverBefore>=0&&beforeLabels[hoverBefore])return {kind:'before',index:hoverBefore,r:pixelBox(beforeLabels[hoverBefore],img.naturalWidth,img.naturalHeight)};
 if(chosen)return {kind:'draw',box:chosen,r:chosen.rect};
 if(selected>=0)return {kind:'label',index:selected,r:boxRect(labels[selected],selected)};
 if(selectedBefore>=0&&beforeLabels[selectedBefore])return {kind:'before',index:selectedBefore,r:pixelBox(beforeLabels[selectedBefore],img.naturalWidth,img.naturalHeight)};
 return null;
}
function syncToolbar(){
 const el=$('boxActions'),info=toolbarInfo();actionTarget=info;
 if(!info){el.hidden=true;return;}
 el.hidden=false;
 $('actionBoxLabel').textContent=info.kind==='draw'?`Vùng #${String(info.box.id).padStart(2,'0')}`:info.kind==='before'?`B · ${beforeLabels[info.index].line} (chỉ xem)`:`A · ${labels[info.index].line}`;
 const allowRemove=info.kind==='draw'||(info.kind==='label'&&canEditAfter());
 $('actionDelete').hidden=!allowRemove;
 $('actionDelete').disabled=!allowRemove;
 $('actionDelete').textContent=info.kind==='label'?'Xóa box A':'Xóa vùng tạm';
 // Locate controls in the same CSS coordinate space as the canvas, including at zoom 400%.
 el.style.visibility='hidden';
 const sx=c.clientWidth/img.naturalWidth,sy=c.clientHeight/img.naturalHeight;
 const w=el.offsetWidth,h=el.offsetHeight,pad=5;
 const r=info.r;
 const center=(r.x1+r.x2)*sx/2;
 const left=Math.max(pad,Math.min(Math.max(pad,c.clientWidth-w-pad),center-w/2));
 // Leave breathing room above the box so the action bar never covers its class tag.
 // At the top edge place actions below the box instead.
 const labelClearance=$('showNumbers').checked?30:10;
 let top=r.y1*sy-h-labelClearance;
 if(top<pad)top=r.y2*sy+10;
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
function applyLabelDrag(point){
 const op=operation;if(!op?.kind?.startsWith('label-')||!point||!img)return;
 const r={...op.orig},W=img.naturalWidth,H=img.naturalHeight;
 if(op.kind==='label-move'){
  const dx=point.x-op.origin.x,dy=point.y-op.origin.y;
  const shiftX=clamp(dx,-r.x1,W-r.x2),shiftY=clamp(dy,-r.y1,H-r.y2);
  r.x1+=shiftX;r.x2+=shiftX;r.y1+=shiftY;r.y2+=shiftY;
 }else{
  const e=op.edge;if(e.includes('left'))r.x1=clamp(point.x,0,r.x2-.1);
  if(e.includes('right'))r.x2=clamp(point.x,r.x1+.1,W);
  if(e.includes('top'))r.y1=clamp(point.y,0,r.y2-.1);
  if(e.includes('bottom'))r.y2=clamp(point.y,r.y1+.1,H);
 }
 op.preview=r;op.changed=Object.keys(r).some(k=>Math.abs(r[k]-op.orig[k])>=0.04);
 rect={...r};
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
 drawnBoxes.push(b);rememberImage();selectDraw(b.id,false);renderDrawnList();scheduleInvalidBoxRemoval(b);
 $('status').textContent=`Đã vẽ Box #${String(b.id).padStart(2,'0')} ${tuple()}; nút sao chép và Xóa hiện ngay trên ảnh${isSmall(b.rect)?' — ⚠ '+axisWarnings(b.rect).join('; '):''}.`;
 return true;
}
function clear(){selectedBefore=-1;hoverBefore=-1;if(operation?.kind==='pan')c.style.cursor='grab';if(active!==null&&c.hasPointerCapture(active))c.releasePointerCapture(active);rect=null;selected=-1;selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;operation=null;regionSource='none';start=null;active=null;overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';$('fallback').hidden=true;$('status').textContent='';redraw();renderDrawnList();}
function syncSourcePicks(){
 const imagePick=document.getElementById('coord_imagePick');
 const labelPick=document.getElementById('coord_labelPick');
 imagePick.textContent=img?'Ảnh khác':'Chọn ảnh gốc';
 imagePick.classList.toggle('isLoadedFile',!!img);
 labelPick.textContent=labelFile?'Chọn nhãn .txt khác':'Chọn nhãn .txt của ảnh';
 labelPick.classList.toggle('isLoadedFile',!!labelFile);
}
function resetLabels(){labels=[];labelFile=null;loadedAfterId='';selected=-1;selectedBefore=-1;hoverDrawId=null;hoverLabel=-1;if(regionSource==='label'){rect=null;regionSource='none';}overlap=[];$('overlapWrap').hidden=true;$('labelMeta').textContent='Chưa có nhãn A cho ảnh này';syncSourcePicks();setOptions();syncAfterControls();redraw();renderDrawnList();}
function attachLabels(file,side='manual'){const boxes=parseLabels(file,false);hoverDrawId=null;hoverLabel=-1;if(img&&imageId(file.name)!==imageId(filename))throw Error('Tên nhãn không khớp ảnh: '+file.name+' / '+filename+'. Chọn đúng nhãn; hậu tố .rf được nhận diện tự động.');boxes.forEach(b=>pixelBox(b,1,1));labelFile=file;loadedAfterId=side==='after'?imageId(filename):'';labels=boxes;selected=-1;selectedBefore=-1;selectedDrawId=null;regionSource='none';rect=null;overlap=[];$('overlapWrap').hidden=true;$('labelMeta').textContent=`${side==='after'?'A · ':''}${file.name}: ${labels.length} box.${side==='after'?' Chọn khung để sửa và tải TXT A.':' Chỉ xem (không thuộc bộ A đã nạp).'}`;syncSourcePicks();$('showBoxes').checked=true;setOptions();syncAfterControls();redraw();renderDrawnList();$('status').textContent=img?(labels.length?'Có thể bấm box TXT hoặc khoanh thêm nhiều vùng khác.':'Nhãn rỗng: chọn Khoanh tay vùng mới.'):'Đã đọc nhãn. Chọn ảnh gốc cùng ID để hiển thị.';}
function useLoaded(side,silent=false){try{if(!img){if(!silent)$('status').textContent='Chọn ảnh gốc trước.';return false;}const map=nameMap(state[side]),f=map.get(imageId(filename));if(!f){if(!silent)$('status').textContent='Không có nhãn A cùng ID trong bộ sau sửa. Nạp bộ A tại mục 01 trước.';return false;}labelSeq++;attachLabels(f,side);return true;}catch(e){if(!silent)$('status').textContent=e.message;return false;}}
// Render text and boxes as SVG primitives at final CSS pixel positions.
// Unlike the 8 MP bitmap canvas, vectors never lose resolution when zoom exceeds 400%.
let vectorFragment=null;
let renderedAfterNodes=new Map(),renderedDrawNodes=new Map();
let dragPaintFrame=0;
function updateLiveRect(node,r){
 if(!node||!r)return;
 node.setAttribute('x',String(r.x1*scale));node.setAttribute('y',String(r.y1*scale));
 node.setAttribute('width',String(Math.max(0,(r.x2-r.x1)*scale)));
 node.setAttribute('height',String(Math.max(0,(r.y2-r.y1)*scale)));
}
// During a drag, update only the target SVG element. No full DOM rebuild, BigInt
// conversion, toolbar measurement, or expensive forced layout per pointer event.
function paintDragFrame(){
 dragPaintFrame=0;
 if(!img||active===null||!operation)return;
 const op=operation;
 if(op.kind==='label-move'||op.kind==='label-resize'){
  const nodes=renderedAfterNodes.get(op.index),r=op.preview;
  if(nodes&&r){updateLiveRect(nodes.shape,r);
   if(nodes.tag)nodes.tag.setAttribute('transform',`translate(${(r.x1-nodes.base.x1)*scale} ${(r.y1-nodes.base.y1)*scale})`);
  }
 }else if(op.kind==='move'||op.kind==='resize'){
  const nodes=renderedDrawNodes.get(op.id),r=savedBox(op.id)?.rect;
  if(nodes&&r){updateLiveRect(nodes.shape,r);
   if(nodes.tag)nodes.tag.setAttribute('transform',`translate(${(r.x1-nodes.base.x1)*scale} ${(r.y1-nodes.base.y1)*scale})`);
  }
 }else if(op.kind==='draw'){
  redraw();return;
 }
 if(rect){$('coord').textContent=tupleFor(rect,$('format').value);
  $('details').textContent=`Rộng ${Number((rect.x2-rect.x1).toFixed(4))} px; cao ${Number((rect.y2-rect.y1).toFixed(4))} px`;
 }
}
function scheduleDragPaint(){if(!dragPaintFrame)dragPaintFrame=requestAnimationFrame(paintDragFrame);}
function cancelDragPaint(){if(dragPaintFrame){cancelAnimationFrame(dragPaintFrame);dragPaintFrame=0;}}
function vectorRect(r,color,width=1.8,fill='none',dash=''){
 if(!r||!Number.isFinite(r.x1+r.y1+r.x2+r.y2))return;
 const x=r.x1*scale,y=r.y1*scale,w=(r.x2-r.x1)*scale,h=(r.y2-r.y1)*scale;
 const node=svgNode('rect',{x,y,width:Math.max(0,w),height:Math.max(0,h),fill,stroke:color,'stroke-width':width,'vector-effect':'non-scaling-stroke','shape-rendering':'geometricPrecision',...(dash?{'stroke-dasharray':dash}:{})});
 vectorFragment.append(node);return node;
}
function drawTag(text,x,y,color,emphasis=false){
 if(!img||!vectorFragment)return;
 const fontPx=scale>=5?10:scale>=2?10.5:11.5,tagH=fontPx+10,pad=5;
 ctx.font=`${emphasis?750:650} ${fontPx}px Arial, sans-serif`;
 const stage=$('stage'),left=stage.scrollLeft,top=stage.scrollTop;
 const viewportWidth=Math.min(c.clientWidth,stage.clientWidth),viewportHeight=Math.min(c.clientHeight,stage.clientHeight);
 const tagW=Math.max(20,Math.min(340,viewportWidth-10,ctx.measureText(text).width+pad*2));
 if(tagW<=5)return;
 const bx=clamp(x,Math.max(2,left+5),Math.max(2,left+viewportWidth-tagW-5));
 const preferred=y-tagH-4;
 const by=clamp(preferred,Math.max(2,top+4),Math.max(2,top+viewportHeight-tagH-4));
 const group=svgNode('g',{'pointer-events':'none'});
 group.append(svgNode('rect',{x:bx,y:by,width:tagW,height:tagH,rx:3.5,fill:color,'fill-opacity':'.96'}));
 const t=svgNode('text',{x:bx+pad,y:by+tagH/2+.35,fill:'#fff','font-family':'Arial, sans-serif','font-weight':emphasis?'750':'650','font-size':fontPx,'dominant-baseline':'middle','text-rendering':'geometricPrecision'});
 t.textContent=text;
 // Using textLength only for lengthy coordinate text preserves all box positions at deep zoom.
 if(ctx.measureText(text).width>tagW-pad*2){t.setAttribute('textLength',tagW-pad*2);t.setAttribute('lengthAdjust','spacingAndGlyphs');}
 group.append(t);vectorFragment.append(group);return group;
}
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
 if(active===null&&(wasDocked!==enabled||previousOffscreen!==offscreen)&&window.YoloCoords?.refresh){
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
 $('selectedName').textContent=selected>=0?`A · ${labelName(labels[selected])} · dòng ${labels[selected].line}`:selectedBefore>=0?`B · ${labelName(beforeLabels[selectedBefore])} · chỉ xem`:selectedDrawId!==null?`Vùng #${String(selectedDrawId).padStart(2,'0')} đang chọn`:operation?.kind==='draw'?'Đang khoanh vùng mới':'Chưa chọn box';
 $('coord').textContent=valid?tuple():'—';$('details').textContent=valid?`Rộng ${Number((rect.x2-rect.x1).toFixed(6))} px; cao ${Number((rect.y2-rect.y1).toFixed(6))} px`:'';
 $('raw').textContent=selected>=0?'Nhãn A YOLO: '+labels[selected].raw:selectedBefore>=0?'Nhãn B YOLO (chỉ xem): '+beforeLabels[selectedBefore].raw:'';
 const outside=selected>=0&&rect&&(rect.x1<0||rect.y1<0||rect.x2>img.naturalWidth||rect.y2>img.naturalHeight);
 $('overflow').hidden=!outside;$('overflow').textContent=outside?'Box A có phần vượt ảnh. Kiểm tra lại, không tự cắt biên.':'';
 syncAfterControls();
 if(!img){vectors.replaceChildren();syncToolbar();return;}
 vectorFragment=document.createDocumentFragment();renderedAfterNodes=new Map();renderedDrawNodes=new Map();
 const stage=$('stage'),left=stage.scrollLeft,top=stage.scrollTop,right=left+stage.clientWidth,bottom=top+stage.clientHeight;
 function visible(r){return r.x2*scale>=left-4&&r.x1*scale<=right+4&&r.y2*scale>=top-4&&r.y1*scale<=bottom+4;}
 // B = blue dashed; ALWAYS readonly. A = turquoise solid and editable. Temporary regions = purple.
 if(showBefore)beforeLabels.forEach((box,index)=>{
  const r=pixelBox(box,img.naturalWidth,img.naturalHeight);if(!visible(r))return;
  const chosen=index===selectedBefore,clr=chosen?'#17419b':'#325cc0';
  vectorRect(r,clr,chosen?2.9:1.65,'none','7 4');
  if($('showNumbers').checked)drawTag(`B · ${labelName(box)} · #${box.line}`,r.x1*scale,r.y1*scale,clr,chosen);
 });
 if($('showBoxes').checked)labels.forEach((box,index)=>{
  const r=boxRect(box,index);if(!visible(r))return;
  const chosen=index===selected,clr=chosen?'#006c61':'#078779';
  const shape=vectorRect(r,clr,chosen?3:2,chosen?'rgba(14,173,144,.08)':'none');
  const tag=$('showNumbers').checked?drawTag(`A · ${labelName(box)} · #${box.line}${chosen?' · '+tupleFor(r,$('format').value):''}`,r.x1*scale,r.y1*scale,clr,chosen):null;
  renderedAfterNodes.set(index,{shape,tag,base:{...r}});
 });
 for(const box of drawnBoxes){
  const r=box.rect;if(!visible(r))continue;
  const chosen=box.id===selectedDrawId,warn=isSmall(r),clr=warn?'#bf3932':chosen?'#7047bd':'#8959c2';
  const shape=vectorRect(r,clr,chosen?3:2,chosen?'rgba(115,65,205,.10)':'rgba(135,80,200,.03)');
  const tag=$('showRegionLabels').checked?drawTag(`${warn?'⚠ ':''}Vùng #${String(box.id).padStart(2,'0')} · ${tupleFor(r,$('format').value)}`,r.x1*scale,r.y1*scale,clr,chosen):null;
  renderedDrawNodes.set(box.id,{shape,tag,base:{...r}});
 }
 if(active!==null&&rect&&operation?.kind==='draw'){
  const r=rect,clr=isSmall(r)?'#bf3932':'#8959c2';
  vectorRect(r,clr,2,'rgba(135,80,200,.09)','5 3');
  drawTag(`Đang vẽ ${tupleFor(r,'integer')} · ${fmtPx(r.x2-r.x1)}×${fmtPx(r.y2-r.y1)} px`,r.x1*scale,r.y1*scale,clr,true);
 }
 vectors.replaceChildren(vectorFragment);vectorFragment=null;
 syncToolbar();
}
function fitImageScale(){
 const stage=$('stage');
 const widthScale=Math.max(1,stage.clientWidth-2)/img.naturalWidth;
 return $('stageShell').classList.contains('coordExpanded')
  ? Math.min(widthScale,Math.max(1,stage.clientHeight-2)/img.naturalHeight)
  : Math.min(1,widthScale);
}
function zoomCenter(){
 const stage=$('stage'),r=stage.getBoundingClientRect();
 return {
  x:(Math.max(0,r.left+stage.clientLeft)+Math.min(window.innerWidth,r.left+stage.clientLeft+stage.clientWidth))/2,
  y:(Math.max(0,r.top+stage.clientTop)+Math.min(window.innerHeight,r.top+stage.clientTop+stage.clientHeight))/2
 };
}
function zoomAnchor(point=zoomCenter()){
 const r=c.getBoundingClientRect();
 return {x:(point.x-r.left)/scale,y:(point.y-r.top)/scale,point};
}
function layout(anchor=null){
 if(!img)return;
 scale=$('zoom').value==='fit'?fitImageScale():Number($('zoom').value);
 const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 // The image remains a native raster photo; frame and label overlay is lossless SVG.
 // No full-size canvas allocation, so even 3200% zoom cannot blur box strokes or text.
 img.classList.toggle('coordPixelImage',scale>=2);
 $('canvasWrap').style.width=w+'px';$('canvasWrap').style.height=h+'px';
 c.style.width=w+'px';c.style.height=h+'px';
 c.width=1;c.height=1;
 vectors.style.width=w+'px';vectors.style.height=h+'px';
 vectors.setAttribute('width',w);vectors.setAttribute('height',h);
 if(anchor){
  const stage=$('stage'),r=c.getBoundingClientRect();
  const point=anchor.center?zoomCenter():anchor.point;
  stage.scrollLeft+=r.left+anchor.x*scale-point.x;
  stage.scrollTop+=r.top+anchor.y*scale-point.y;
 }
 redraw();
}

// Mở ảnh trực tiếp từ File dùng chung với mục 04 mà không cần gán FileList vào input.
function openCoordinateImage(file){
 coordCanvasEngaged=false;
 if(!file)return Promise.resolve(false);
 const seq=++loadSeq,url=URL.createObjectURL(file),next=new Image();
 return new Promise(resolve=>{
  next.onload=()=>{
   URL.revokeObjectURL(url);
   if(seq!==loadSeq){resolve(false);return;}
   rememberImage();if(zoomFrame)cancelAnimationFrame(zoomFrame);
   zoomFrame=0;pendingZoom=null;touchPoints.clear();pinch=null;safariGesture=null;
   $('canvasWrap').querySelector('.coordSourceImage')?.remove();
   img=next;img.className='coordSourceImage';img.alt='';img.draggable=false;$('canvasWrap').prepend(img);
   filename=file.name;restoreImage();clear();
   if(labelFile&&imageId(labelFile.name)!==imageId(filename))resetLabels();
   $('empty').hidden=true;$('canvasWrap').hidden=false;c.hidden=false;
   $('toolSelect').disabled=false;$('toolDraw').disabled=false;$('workspace').hidden=false;
   document.getElementById('coord_floatingTools').hidden=false;
   document.getElementById('coord_stageShell').classList.add('has-image');
   document.querySelector('.coordExtras').hidden=false;
   $('meta').textContent=`${filename}; ${img.naturalWidth} × ${img.naturalHeight} px`;
   syncSourcePicks();$('fallback').hidden=true;syncBeforeOverlay();
   if(!labelFile)useLoaded('after',true);
   setOptions();layout();renderDrawnList();
   $('status').textContent=`Đã mở ảnh. Có ${drawnBoxes.length} box đã khoanh/nhập trên ảnh này.`;
   resolve(true);
  };
  next.onerror=()=>{URL.revokeObjectURL(url);if(seq===loadSeq)$('status').textContent='Không mở được ảnh. Chọn JPG/PNG hợp lệ.';resolve(false);};
  next.src=url;
 });
}
$('file').addEventListener('change',()=>{
 const file=$('file').files[0];if(!file)return;
 openCoordinateImage(file);
 // Mở ảnh riêng ở mục 05 cũng đăng ký vào kho ảnh gốc dùng chung mục 04.
 window.MatchReview?.addImages?.([file]);
});
// Datalist hiển thị các ID đã được nạp ở mục 04 hoặc mục 05 (không copy ảnh).
function syncSharedImageIds(){
 const ids=window.MatchReview?.listImageIds?.()||[];
 const list=$('imageIds');list.replaceChildren();
 const fragment=document.createDocumentFragment();
 for(const id of ids){const option=document.createElement('option');option.value=id;fragment.append(option);}
 list.append(fragment);
 $('imageCount').textContent=ids.length
  ?`Đã có ${ids.length} ảnh trong kho dữ liệu chung. Nhập image_id và nhấn Enter để mở.`
  :'Chưa có ảnh. Nạp ảnh ở mục 01 trước, sau đó nhập image_id để mở.';
}
function openByImageId(){
 const input=$('imageId'),typed=input.value.trim(),ids=window.MatchReview?.listImageIds?.()||[];
 if(!typed){$('status').textContent='Hãy nhập image_id để mở ảnh đã nạp.';return;}
 const key=imageId(typed),exact=ids.find(id=>id.toLowerCase()===key.toLowerCase());
 const matching=exact?[exact]:ids.filter(id=>id.toLowerCase().includes(key.toLowerCase()));
 if(!matching.length){$('status').textContent='Không tìm thấy ảnh cho ID: '+typed+'. Hãy bổ sung ảnh tại mục 01.';return;}
 if(matching.length>1){$('status').textContent='Có '+matching.length+' ảnh trùng phần ID. Hãy nhập ID đầy đủ hoặc chọn gợi ý.';return;}
 const file=window.MatchReview?.getImageFile?.(matching[0]);
 if(!file){$('status').textContent='Không tìm thấy tệp ảnh tương ứng. Vui lòng nạp lại thư mục.';return;}
 input.value=matching[0];openCoordinateImage(file);
}
$('openById').addEventListener('click',openByImageId);
$('imageId').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();openByImageId();}});
$('imageFolder').addEventListener('change',async event=>{
 const files=[...event.target.files].filter(file=>/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i.test(file.name));
 if(!files.length){$('status').textContent='Thư mục không có ảnh JPG/PNG/WebP hợp lệ.';return;}
 if(!window.MatchReview?.addImages){$('status').textContent='Chưa khởi tạo bộ ảnh chung. Vui lòng tải lại trang.';return;}
 const ok=await window.MatchReview.addImages(files);
 if(ok){syncSharedImageIds();$('status').textContent=`Đã nạp ${files.length} ảnh vào kho dùng chung. Nhập image_id và nhấn Enter để mở.`;}
 event.target.value='';
});
window.addEventListener('yolo:images-updated',syncSharedImageIds);
queueMicrotask(syncSharedImageIds);

$('labelFile').addEventListener('change',async()=>{const file=$('labelFile').files[0];if(!file)return;const seq=++labelSeq;try{const text=await file.text();if(seq!==labelSeq)return;attachLabels({name:file.name,path:file.name,text});}catch(e){if(seq!==labelSeq)return;resetLabels();$('status').textContent=e.message;}});
$('useBefore').onclick=()=>{showBefore=!showBefore;selectedBefore=-1;syncAfterControls();redraw();};
$('useAfter').onclick=()=>{if(!useLoaded('after'))$('status').textContent='Nhãn A chưa được nạp ở mục 01.';};
$('afterClass').addEventListener('change',()=>{if(selected<0||!canEditAfter())return;try{rewriteAfter(selected,{classId:Number($('afterClass').value)});selectBox(Math.min(selected,labels.length-1));}catch(e){$('status').textContent=e.message;}});
function deleteAfterIndex(index){
 if(!Number.isInteger(index)||index<0||!canEditAfter())return;
 const box=labels[index];if(!box)return;
 if(!window.confirm(`Xóa box A dòng ${box.line} (${labelName(box)})?\n\nChỉ thay đổi nhãn A trong phiên. B ban đầu và file trên máy được giữ nguyên.`))return;
 try{rewriteAfter(index,{remove:true});clear();}catch(e){$('status').textContent=e.message;}
}
$('deleteAfter').addEventListener('click',()=>deleteAfterIndex(selected));
$('exportAfter').addEventListener('click',()=>{const source=afterEntry();if(!source)return;const data=new Blob([source.text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=source.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('status').textContent=`Đã yêu cầu tải ${source.name}. Đây là nhãn A đang có trong phiên, không phải nhãn B.`;});
window.addEventListener('yolo:labels-updated',event=>{if(!img||event.detail?.source==='coordinates')return;if(event.detail?.side==='before')syncBeforeOverlay();if(event.detail?.side==='after'){resetLabels();useLoaded('after',true);}redraw();});

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
  cancelInvalidBoxRemoval(hit); // Tạm ngưng tự xóa khi người dùng đang chỉnh sửa box.
  hoverDrawId=hit.id;selectDraw(hit.id,true);
  const edge=previouslySelected?resizeEdges(point,hit.rect):'';
  active=e.pointerId;c.setPointerCapture(active);
  operation={kind:edge?'resize':'move',id:hit.id,edge,origin:point,orig:{...hit.rect},changed:false,dragStartClient:{x:e.clientX,y:e.clientY},startScale:scale};
  redraw();return;
 }
 if($('mode').value==='select'){
  hoverDrawId=null;hoverLabel=-1;hoverBefore=-1;
  overlap=$('showBoxes').checked?hitCandidates(labels,point,img.naturalWidth,img.naturalHeight):[];
  if(overlap.length){
   const index=overlap[0],wasSelected=index===selected;
   selectBox(index);setOverlap();
   if(canEditAfter()){
    const initial=pixelBox(labels[index],img.naturalWidth,img.naturalHeight);
    const edge=wasSelected?resizeEdges(point,initial):'';
    active=e.pointerId;c.setPointerCapture(active);
    operation={kind:edge?'label-resize':'label-move',index,edge,origin:point,orig:{...initial},preview:{...initial},changed:false,dragStartClient:{x:e.clientX,y:e.clientY},startScale:scale};
   }
   return;
  }
  if(showBefore){const beforeHit=hitCandidates(beforeLabels,point,img.naturalWidth,img.naturalHeight)[0];if(beforeHit!==undefined){selectBeforeBox(beforeHit);return;}}
  clear();
  const stage=$('stage');
  operation={kind:'pan',x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};
  active=e.pointerId;c.setPointerCapture(active);
  c.style.cursor='grabbing';
  return;
 }
 selected=-1;selectedDrawId=null;hoverDrawId=null;hoverLabel=-1;regionSource='draw';overlap=[];$('overlapWrap').hidden=true;$('boxSelect').value='';
 active=e.pointerId;c.setPointerCapture(active);start=point;operation={kind:'draw',origin:point,dragStartClient:{x:e.clientX,y:e.clientY},startScale:scale};rect=normalized(start,start);
 $('status').textContent='Đang khoanh box mới; thả chuột để lưu. Chỉ cảnh báo khi chiều cao dưới 12 px.';redraw();
});
// Keep drag coordinates stable even if a sticky toolbar or browser scroll shifts
// the canvas while the pointer is captured. Delta is measured in screen pixels.
function dragPoint(e){
 const op=operation;
 if(op?.dragStartClient&&op.origin){
  const factor=op.startScale||scale;
  return {x:op.origin.x+(e.clientX-op.dragStartClient.x)/factor,
          y:op.origin.y+(e.clientY-op.dragStartClient.y)/factor};
 }
 return bounds(e);
}
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
 const point=active===e.pointerId?dragPoint(e):bounds(e);
 if(active===e.pointerId){
  if(operation?.kind==='draw'&&start)rect=normalized(start,point);
  else if(operation?.kind?.startsWith('label-'))applyLabelDrag(point);
  else applyDrag(point);
  scheduleDragPaint();return;
 }
 const hit=hitDrawn(point),nextHover=hit?.id||null;
 const nextLabel=!hit&&e.pointerType!=='touch'&&$('mode').value==='select'&&$('showBoxes').checked
   ? hitCandidates(labels,point,img.naturalWidth,img.naturalHeight)[0]??-1 : -1;
 const nextBefore=!hit&&nextLabel<0&&showBefore&&$('mode').value==='select'?hitCandidates(beforeLabels,point,img.naturalWidth,img.naturalHeight)[0]??-1:-1;
 if(hoverDrawId!==nextHover||hoverLabel!==nextLabel||hoverBefore!==nextBefore){hoverDrawId=nextHover;hoverLabel=nextLabel;hoverBefore=nextBefore;syncToolbar();}
 if(hit){const edge=hit.id===selectedDrawId?resizeEdges(point,hit.rect):'';c.style.cursor=edge?cursorForEdge(edge):'move';}
 else if(nextLabel>=0&&canEditAfter()){const edge=selected===nextLabel?resizeEdges(point,pixelBox(labels[nextLabel],img.naturalWidth,img.naturalHeight)):'';c.style.cursor=edge?cursorForEdge(edge):'move';}
 else c.style.cursor=$('mode').value==='select'?(nextLabel>=0||nextBefore>=0?'pointer':'grab'):'crosshair';
});
c.addEventListener('pointerleave',e=>{if(e.relatedTarget===$('boxActions')||$('boxActions').contains(e.relatedTarget))return;if(active===null){hoverDrawId=null;hoverLabel=-1;hoverBefore=-1;syncToolbar();}});
$('boxActions').addEventListener('pointerleave',e=>{
 if(e.relatedTarget===c)return;
 hoverDrawId=null;hoverLabel=-1;hoverBefore=-1;syncToolbar();
});
function end(e){
 if(active!==e.pointerId)return;
 cancelDragPaint();
 const op=operation;
 if(op?.kind==='pan'){
  if(e.type==='pointerup')panImage(e);
  active=null;operation=null;
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  c.style.cursor='grab';
  return;
 }
 const point=img?dragPoint(e):null;
 if(op?.kind?.startsWith('label-')){
  if(e.type==='pointerup'){applyLabelDrag(point);if(op.changed){
    try{rewriteAfter(op.index,{rect:op.preview});selected=op.index;rect=pixelBox(labels[op.index],img.naturalWidth,img.naturalHeight);regionSource='label';}
    catch(error){$('status').textContent=error.message;rect=op.orig;}
   }}
  start=null;active=null;operation=null;
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  redraw();return;
 }
 if(e.type==='pointerup'&&op?.kind==='draw'&&start){const fresh=normalized(start,point);start=null;active=null;operation=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  if(fresh.x2>fresh.x1&&fresh.y2>fresh.y1){addDrawnBox(fresh,'draw');}else{rect=null;regionSource='none';$('status').textContent='Vùng có chiều rộng hoặc cao bằng 0 px, chưa lưu.';redraw();}
  return;
 }
 if(op&&(op.kind==='move'||op.kind==='resize')){
  if(e.type==='pointercancel'){const b=savedBox(op.id);if(b)b.rect={...op.orig};}
  else applyDrag(point);
  const b=savedBox(op.id);if(b){rect={...b.rect};regionSource=b.source;rememberImage();scheduleInvalidBoxRemoval(b);}
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
 if(e.target.closest('#coordsSection, #coord_boxActions, #coord_floatingTools, #coord_overlapWrap, #coord_boxSelect, #coord_applyNote, #coord_format, .coordZoomControl, .qcInlineActions'))return;
 clear();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('stageShell').classList.contains('coordExpanded')&&(!e.target.closest('input,textarea,select')||e.target===c))clear();});
function syncZoomButtons(){document.querySelectorAll('[data-coord-zoom]').forEach(btn=>{const on=btn.dataset.coordZoom===$('zoom').value;btn.classList.toggle('is-active',on);btn.setAttribute('aria-pressed',String(on));});}
const zoomSelect=$('zoom');
function setZoom(value,anchor){
 if(!img)return;
 if(zoomSelect.value===String(value)){
  if(anchor)layout(anchor);
  return;
 }
 const custom=zoomSelect.querySelector('[data-custom-zoom]');
 if(custom)custom.remove();
 if(!Array.from(zoomSelect.options).some(option=>option.value===String(value))){
  const option=document.createElement('option');
  option.value=String(value);option.textContent=Math.round(Number(value)*100)+'%';
  option.dataset.customZoom='true';zoomSelect.append(option);
 }
 const focus=anchor||(rect&&img?{x:(rect.x1+rect.x2)/2,y:(rect.y1+rect.y2)/2,point:zoomCenter(),center:true}:{...zoomAnchor(),center:true});
 zoomSelect.value=String(value);
 syncZoomButtons();layout(focus);
 zoomSelect.dispatchEvent(new Event('change',{bubbles:true}));
}
document.querySelectorAll('[data-coord-zoom]').forEach(btn=>btn.addEventListener('click',()=>setZoom(btn.dataset.coordZoom)));
zoomSelect.onchange=()=>{
 if(!img)return;
 const next=zoomSelect.value==='fit'?fitImageScale():Number(zoomSelect.value);
 if(next!==scale){const anchor={...zoomAnchor(),center:true};syncZoomButtons();layout(anchor);}
};
syncZoomButtons();
let zoomFrame=0,pendingZoom=null;
function queueZoom(value,anchor){
 pendingZoom={value:clamp(value,Math.min(.1,fitImageScale()),Math.max(MAX_ZOOM,fitImageScale())),anchor};
 if(zoomFrame)return;
 zoomFrame=requestAnimationFrame(()=>{
  const next=pendingZoom;pendingZoom=null;zoomFrame=0;
  setZoom(next.value,next.anchor);
 });
}
const zoomStage=$('stage'),touchPoints=new Map();
let pinch=null,safariGesture=null;
function touchGeometry(){
 const [a,b]=Array.from(touchPoints.values());
 return {distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
}
zoomStage.addEventListener('pointerdown',e=>{
 if(!img||e.pointerType!=='touch'||e.target.closest('#coord_boxActions'))return;
 touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
 zoomStage.setPointerCapture(e.pointerId);
 if(touchPoints.size<2)return;
 e.preventDefault();e.stopPropagation();
 if(active!==null)end({type:'pointercancel',pointerId:active});
 if(regionSource==='draw'&&selectedDrawId===null){rect=null;regionSource='none';}
 const gesture=touchGeometry();
 pinch={distance:gesture.distance,scale,anchor:zoomAnchor(gesture.point)};
 for(const id of touchPoints.keys())zoomStage.setPointerCapture(id);
 redraw();
},{capture:true});
zoomStage.addEventListener('pointermove',e=>{
 if(!touchPoints.has(e.pointerId))return;
 touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(!pinch)return;
 e.preventDefault();e.stopPropagation();
 if(touchPoints.size<2)return;
 const gesture=touchGeometry();
 queueZoom(pinch.scale*gesture.distance/pinch.distance,{...pinch.anchor,point:gesture.point});
},{capture:true});
function endPinch(e){
 if(!touchPoints.has(e.pointerId))return;
 touchPoints.delete(e.pointerId);
 if(!pinch)return;
 e.preventDefault();e.stopPropagation();
 if(touchPoints.size>=2){
  const gesture=touchGeometry();
  pinch={distance:gesture.distance,scale,anchor:zoomAnchor(gesture.point)};
 }
 if(!touchPoints.size)pinch=null;
}
zoomStage.addEventListener('pointerup',endPinch,{capture:true});
zoomStage.addEventListener('pointercancel',endPinch,{capture:true});
let svgScrollFrame=0;
zoomStage.addEventListener('scroll',()=>{if(svgScrollFrame)return;svgScrollFrame=requestAnimationFrame(()=>{svgScrollFrame=0;redraw();});},{passive:true});
zoomStage.addEventListener('wheel',e=>{
 if(!img||e.target!==c||!(e.ctrlKey||e.metaKey))return;
 e.preventDefault();
 if(safariGesture||pinch||active!==null)return;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?zoomStage.clientHeight:1);
 const current=pendingZoom?.value??scale;
 queueZoom(current*Math.exp(-delta*.01),zoomAnchor({x:e.clientX,y:e.clientY}));
},{passive:false});
zoomStage.addEventListener('gesturestart',e=>{
 if(!img)return;
 e.preventDefault();
 if(touchPoints.size||active!==null)return;
 safariGesture={scale,anchor:zoomAnchor({x:e.clientX,y:e.clientY})};
},{passive:false});
zoomStage.addEventListener('gesturechange',e=>{
 if(!img)return;
 e.preventDefault();
 if(safariGesture)queueZoom(safariGesture.scale*Math.pow(e.scale,2),safariGesture.anchor);
},{passive:false});
zoomStage.addEventListener('gestureend',e=>{
 if(!img)return;
 e.preventDefault();safariGesture=null;
},{passive:false});
window.addEventListener('blur',()=>{touchPoints.clear();pinch=null;safariGesture=null;});
document.addEventListener('keydown',e=>{
 if(!img||e.altKey||!(e.ctrlKey||e.metaKey)||e.target.closest('input:not([type="range"]),textarea,[contenteditable="true"]'))return;
 const zoomIn=e.key==='+'||e.key==='='||e.code==='NumpadAdd';
 const zoomOut=e.key==='-'||e.key==='−'||e.code==='NumpadSubtract';
 if(!zoomIn&&!zoomOut)return;
 const stage=$('stage').getBoundingClientRect();
 if(stage.bottom<=0||stage.top>=window.innerHeight)return;
 e.preventDefault();
 const levels=Array.from(zoomSelect.options).filter(option=>option.value!=='fit'&&!option.dataset.customZoom);
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
  if(heightWarnings.length)parts.push(`⚠ Chiều cao < 12 px tại mục: ${heightWarnings.join(', ')} (box tự xóa sau 0,5 giây).`);
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
function deleteBox(id,silent=false){
 const b=savedBox(id);if(!b)return;
 cancelInvalidBoxRemoval(b);
 drawnBoxes=drawnBoxes.filter(x=>x!==b);
 if(selectedDrawId===id){selectedDrawId=null;rect=null;regionSource='none';}
 hoverDrawId=null;hoverLabel=-1;renumberBoxes();rememberImage();
 $('status').textContent='';
 if(!silent)showActionFeedback(`Đã xóa Box #${String(id).padStart(2,'0')}. Đã đánh số lại ${drawnBoxes.length} box còn lại từ #01.`);
 redraw();renderDrawnList();
}
$('actionCopy').onclick=()=>{
 const t=actionTarget;if(!t)return;
 if(t.kind==='draw'){selectDraw(t.box.id,true);copy(tupleFor(t.box.rect,$('format').value),$('actionCopy'));}
 else if(t.kind==='before'){selectBeforeBox(t.index);copy(tupleFor(t.r,$('format').value),$('actionCopy'));}
 else{selectBox(t.index);copy(tupleFor(t.r,$('format').value),$('actionCopy'));}
};
$('actionNote').onclick=()=>{
 const t=actionTarget;if(!t)return;
 if(t.kind==='draw'){selectDraw(t.box.id,true);copy(noteFor(t.box.rect,t.box.source,t.box.id),$('actionNote'));}
 else if(t.kind==='before'){selectBeforeBox(t.index);copy(`image_id: ${imageId(filename)}\nsource: B_initial_readonly\nregion_xyxy: ${tupleFor(t.r,$('format').value)}\nclass_id: ${beforeLabels[t.index].c}\nyolo: ${beforeLabels[t.index].raw}`, $('actionNote'));}
 else{selectBox(t.index);copy(noteFor(t.r,'label',null,t.index),$('actionNote'));}
};
$('actionDelete').onclick=()=>{
 const t=actionTarget;
 if(t?.kind==='draw')deleteBox(t.box.id);
 else if(t?.kind==='label')deleteAfterIndex(t.index);
 // Before/B is deliberately read-only even if a stale click reaches here.
};
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

$('deleteAll').onclick=()=>{if(!drawnBoxes.length)return;if(!window.confirm(`Xóa toàn bộ ${drawnBoxes.length} box đã vẽ trên ảnh này? Việc này không sửa nhãn TXT.`))return;cancelAllInvalidBoxRemovals();drawnBoxes=[];nextBoxNo=1;rememberImage();clear();$('status').textContent='';showActionFeedback('Đã xóa toàn bộ box được khoanh/nhập trên ảnh này.');};
$('applyNote').onclick=()=>{if(!rect||rect.x2<=rect.x1||rect.y2<=rect.y1)return;const context=selected>=0?`box TXT dòng ${labels[selected].line}, lớp ${labelName(labels[selected])}`:selectedDrawId!==null?`box #${String(selectedDrawId).padStart(2,'0')}, ${regionSource==='input'?'nhập tọa độ':'khoanh tay'}`:'vùng khoanh tay';const ok=applyPixelRegion(filename,tuple(),context);$('status').textContent=ok?'Đã ghi tọa độ box đang chọn vào notes đúng ảnh.':'Chưa thấy ảnh trong log. Chạy So sánh nhãn và dùng đúng ID ảnh.';};
// Nhảy trực tiếp từ QC tới đúng ảnh + đúng dòng A. Không chỉnh nhãn B.
async function focusQCBox(id,line,code=''){
 const key=String(id||'').trim(),targetLine=Number(line);
 if(!key||!Number.isInteger(targetLine)||targetLine<1)throw Error('Chưa có image_id hoặc dòng box hợp lệ.');
 const source=nameMap(state.after).get(key);
 if(!source)throw Error(`Không tìm thấy nhãn A của ${key}. Nạp nhãn A ở mục 01.`);
 const file=window.MatchReview?.getImageFile?.(key);
 if(!file)throw Error(`Thiếu ảnh gốc ${key}. Nạp ảnh gốc ở mục 01 trước khi sửa trực quan.`);
 if(!img||imageId(filename)!==key){
  if(!await openCoordinateImage(file))throw Error(`Không mở được ảnh ${key}.`);
 }
 // Bắt buộc lấy bản nhãn A mới nhất, tránh chỉnh nhầm file TXT được mở thủ công.
 if(labelFile!==source||loadedAfterId!==key){if(!useLoaded('after'))throw Error('Không đọc được nhãn A. Hãy sửa các dòng TXT sai định dạng ở QC trước.');}
 const index=labels.findIndex(b=>b.line===targetLine);
 if(index<0)throw Error(`Không tìm thấy box A dòng ${targetLine}. Hãy chạy QC lại.`);
 selectBox(index);
 const r=pixelBox(labels[index],img.naturalWidth,img.naturalHeight);
 const w=Math.max(.1,r.x2-r.x1),h=Math.max(.1,r.y2-r.y1);
 const focusZoom=Math.min(16,Math.max(scale,Math.min(16,75/Math.min(w,h))));
 if(focusZoom>scale*1.3)setZoom(focusZoom,{x:(r.x1+r.x2)/2,y:(r.y1+r.y2)/2,point:zoomCenter(),center:true});
 requestAnimationFrame(()=>focusOnImage(r));
 const context=document.getElementById('coord_qcContext');
 if(context){context.hidden=false;document.getElementById('coord_qcContextText').textContent=`Từ QC · ${key} · box A${targetLine}${code?' · '+code:''} · chỉ sửa nhãn A`;} 
 $('imageId').value=key;
 $('status').textContent=`Đang sửa box A${targetLine} (${key}) từ QC. Khung A xanh ngọc được chọn; khung B xanh lam chỉ xem. Kéo cạnh/góc để chỉnh và tải lại TXT A.`;
 document.getElementById('coordsSection').scrollIntoView({behavior:'smooth',block:'start'});
 return true;
}
const backQC=document.getElementById('coord_qcBack');
if(backQC)backQC.addEventListener('click',()=>{
 document.getElementById('prepSection').scrollIntoView({behavior:'smooth',block:'start'});
});
window.YoloCoords={normalized,pixelBox,tupleFor,hitCandidates,tuple,refresh:redraw,focusQCBox,setZoom:queueZoom,getZoom:()=>scale,getFitScale:()=>img?fitImageScale():1,getMaxZoom:()=>img?Math.max(MAX_ZOOM,fitImageScale()):MAX_ZOOM,getRegions:()=>drawnBoxes.map(b=>({...b,rect:{...b.rect}}))};redraw();renderDrawnList();
})();