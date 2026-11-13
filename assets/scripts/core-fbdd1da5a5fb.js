(function(){
'use strict';
const $=id=>document.getElementById('vm_'+id),V={key:'',old:-1,next:-1,images:new Map,imagesAfter:new Map,img:null,imgAfter:null,hiddenB:new Set,hiddenA:new Set,seq:0,hold:false,holdTimer:null,suppressClick:false,zoom:1,zoomMode:false,cx:.5,cy:.5,panning:null,touches:new Map,pinch:null,gesture:null,stageHover:false,shortRows:[],shortSelected:new Set,shortSizes:new Map,shortScanSeq:0,shortScanning:false,deletedA:[],shortPreviewSeq:0};
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function entry(){return state.valid?state.rows.find(r=>reviewKey(r)===V.key):null;}
function keyOfImage(name){return cleanId(name.replace(/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i,'.txt'),true);}
function message(text,error=false){$('message').textContent=text;$('message').className='notice'+(error?' error':'');}
function review(e=entry()){return state.matchReviews.get(e?reviewKey(e):V.key)||{links:[],removed:[],added:[],rejected:[]};}
function name(box){let names;try{names=currentNames();}catch{}return classLabel(box.c,names||null);}
function maps(e){const pairs=e.matching.res.pairs,pb=new Map,pa=new Map;[...pairs].sort((a,b)=>e.matching.a[a[0]].line-e.matching.a[b[0]].line).forEach((p,index)=>{pb.set(p[0],{other:p[1],p:index+1,manual:!!p[3]});pa.set(p[1],{other:p[0],p:index+1,manual:!!p[3]});});return {pb,pa};}
function guard(){const e=entry();if(!e?.matching)throw Error('Chạy So sánh nhãn và chọn ảnh có đủ nhãn trước/sau.');return e;}
function signature(e){return {image_id:reviewKey(e),before_labels:e.matching.a.map(x=>[x.line,x.raw]),after_labels:e.matching.b.map(x=>[x.line,x.raw])};}
function exportObject(){return {format:'yolo_matching_review_v1',images:state.rows.filter(e=>e.matching&&state.matchReviews.has(reviewKey(e))).map(e=>({...signature(e),decisions:state.matchReviews.get(reviewKey(e))}))};}
function exportEntries(){return state.matchReviews.size?[{name:'matching_decisions.json',data:JSON.stringify(exportObject(),null,2)}]:[];}
function updateRow(e){
 const key=reviewKey(e),m=e.matching,res=diff(m.a,m.b,m.threshold,m.clampedLines,state.matchReviews.get(key));m.res=res;
 const events=enrichEvents(res.events,state.classes).map(event=>({...event,exported_before_clamp:state.prepared?.changes.find(c=>c.image_id===key&&c.line_number===event.after_line)?.before||''}));
 Object.assign(e.data,res.counts);e.events=events;e.alerts=[...res.warnings];
 let auto=`Đối chiếu nhãn: thêm ${res.counts.boxes_added} box; xóa ${res.counts.boxes_removed} box; sửa ${res.counts.boxes_modified} box có sẵn, trong đó đổi lớp ${res.counts.class_changes}, đổi hình học ${res.counts.geometry_changes}.`;
 const classNote=describeClasses(events,state.classes);if(classNote)auto+=' '+classNote;if(res.clamps)auto+=` Có ${res.clamps} box thuộc nhãn ban đầu được cắt biên về [0,1], đã được tính trong geometry_changes.`;
 const n=state.matchReviews.get(key)?.links.length||0;if(n)auto+=` Đã xác nhận trực quan ${n} cặp box trước/sau.`;
 if(e.data.notes.startsWith(e.autoNotes)){e.data.notes=auto+e.data.notes.slice(e.autoNotes.length);e.autoNotes=auto;}else e.alerts.push('Số đếm đã cập nhật; notes bạn chỉnh tay được giữ nguyên, cần kiểm tra lại nội dung số liệu.');
 if(e.data.review_status!=='needs_adjudication')e.data.review_status='';
 state.details=state.rows.flatMap(r=>r.events.map(x=>({image_id:r.data.image_id,...x})));state.warnings=state.rows.flatMap(r=>r.alerts.map(w=>({image_id:r.data.image_id,warning:w})));render();
}
function selected(e){return {a:e.matching.a[V.old],b:e.matching.b[V.next]};}
// Kiểm tra chỉ các nhãn A (sau sửa), theo chiều cao pixel THẬT của ảnh gốc.
// Không ghi đè tệp trên đĩa. Mọi thao tác xóa phải xác nhận trong modal toàn màn hình.
const SHORT_A_LIMIT=12;
function shortId(box,key){return key+'::'+box.line;}
function shortLabel(box){return name(box);}
function afterLabelRows(){
 const out=[];for(const file of state.after){const key=cleanId(file.name,document.getElementById('normalize').checked);
  const boxes=[];for(const [i,raw] of file.text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
   const p=raw.trim().split(/\s+/);if(p.length!==5||!/^[0-3]$/.test(p[0]))continue;
   const g=p.slice(1).map(Number);if(g.some(n=>!Number.isFinite(n))||g[2]<=0||g[3]<=0)continue;
   boxes.push({line:i+1,c:Number(p[0]),g,raw:raw.trim()});
  }
  out.push({key,file,boxes});
 }return out;
}
function showShortPanel(){
 const panel=$('shortPanel'),fold=document.getElementById('qcSmallBoxFold');
 const count=V.shortRows.length,eligible=afterLabelRows(),unloaded=eligible.filter(e=>!V.images.has(e.key)).length;
 const shouldShow=!!state.after.length;
 panel.hidden=!shouldShow;fold.hidden=!shouldShow||!count;
 if(!shouldShow){document.getElementById('qcShortPreview').hidden=true;return;}
 document.getElementById('qcSmallBoxCount').textContent=count?`${count} box cảnh báo · mở để xem ảnh và quyết định`:'Chưa phát hiện box dưới 12 px';
 $('shortSummary').textContent=V.shortScanning
  ?`Đang kiểm tra chiều cao box A trên ${eligible.length-unloaded} ảnh đã tải…`
  :count?`Phát hiện ${count} box A cao dưới ${SHORT_A_LIMIT}px trên ${new Set(V.shortRows.map(x=>x.key)).size} ảnh. ${unloaded?`Còn ${unloaded} ảnh chưa có ảnh gốc để kiểm tra.`:''}`
  :unloaded?`Chưa phát hiện box A vi phạm trên ảnh đã nạp; còn ${unloaded} ảnh thiếu ảnh gốc.`
  :`Không phát hiện bounding box A cao dưới ${SHORT_A_LIMIT}px trong ${eligible.length} ảnh đã kiểm tra.`;
 $('shortContent').hidden=!count;
 if(!count)document.getElementById('qcShortPreview').hidden=true;
 const body=$('shortList');body.replaceChildren();
 for(const x of V.shortRows){
  const row=node('tr'),cell=node('td'),check=node('input');check.type='checkbox';check.checked=V.shortSelected.has(x.id);
  check.setAttribute('aria-label',`Chọn box A${x.line}, ${x.className}, ảnh ${x.key}`);
  check.addEventListener('change',()=>{check.checked?V.shortSelected.add(x.id):V.shortSelected.delete(x.id);shortUpdateSelected();});
  const edit=node('button','Chỉnh sửa');edit.type='button';edit.className='qcShortSee';edit.addEventListener('click',()=>{Promise.resolve(editOneShortBox(x.key,x.line)).catch(err=>{document.getElementById('qcShortActionMessage').textContent=err.message;});});
  const del=node('button','Xóa');del.type='button';del.className='qcShortSee qcShortSingleDelete';del.addEventListener('click',()=>deleteOneShortBox(x.key,x.line));
  cell.append(check);row.append(cell,node('td',x.key),node('td','A'+x.line),node('td',x.className),node('td',x.height.toFixed(2)+' px'));
  const view=node('td');view.className='qcInlineActions';view.append(edit,del);row.append(view);body.append(row);
 }
 shortUpdateSelected();
}
async function previewShortBox(x){
 const seq=++V.shortPreviewSeq,preview=document.getElementById('qcShortPreview');preview.hidden=false;
 document.getElementById('qcShortPreviewTitle').textContent=`${x.key} · box A${x.line} · ${x.height.toFixed(2)} px`;
 const file=V.images.get(x.key);if(!file){$('shortSummary').textContent='Thiếu ảnh gốc để hiển thị box này.';return;}
 try{const img=await decode(file);if(seq!==V.shortPreviewSeq)return;
  const W=img.naturalWidth,H=img.naturalHeight,g=x.g,[cx,cy,bw,bh]=g;
  const overview=document.getElementById('qcShortOverviewCanvas');const scale=Math.min(840/W,440/H,1);
  overview.width=Math.max(1,Math.round(W*scale));overview.height=Math.max(1,Math.round(H*scale));
  const ctx=overview.getContext('2d');ctx.drawImage(img,0,0,overview.width,overview.height);
  ctx.save();ctx.strokeStyle='#d73335';ctx.lineWidth=3;ctx.strokeRect((cx-bw/2)*overview.width,(cy-bh/2)*overview.height,Math.max(2,bw*overview.width),Math.max(2,bh*overview.height));ctx.restore();
  const crop=document.getElementById('qcShortCropCanvas');crop.width=360;crop.height=240;
  const c=crop.getContext('2d');const centerX=cx*W,centerY=cy*H;
  const half=Math.max(55,Math.max(bw*W,bh*H)*2.5);
  const cropW=Math.min(W,half*3),cropH=Math.min(H,cropW*2/3),sx=Math.min(Math.max(0,centerX-cropW/2),Math.max(0,W-cropW)),sy=Math.min(Math.max(0,centerY-cropH/2),Math.max(0,H-cropH));
  c.drawImage(img,sx,sy,cropW,cropH,0,0,crop.width,crop.height);
  const scaleX=crop.width/cropW,scaleY=crop.height/cropH;
  c.strokeStyle='#d73335';c.lineWidth=3;
  c.strokeRect(((cx-bw/2)*W-sx)*scaleX,((cy-bh/2)*H-sy)*scaleY,Math.max(2,bw*W*scaleX),Math.max(2,bh*H*scaleY));
 }catch(err){if(seq===V.shortPreviewSeq)document.getElementById('qcShortPreviewTitle').textContent=`Không mở được ảnh: ${err.message}`;}
}
function openShortWarning(imageId,line){
 const row=V.shortRows.find(x=>x.key===imageId&&x.line===line);
 if(row){void previewShortBox(row);document.getElementById('qcShortPreview').scrollIntoView({behavior:'smooth',block:'nearest'});}
 else document.getElementById('afterQcTableWrap')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function deleteOneShortBox(key,line){
 const x=V.shortRows.find(row=>row.key===key&&row.line===line);
 if(!x)return false;
 V.shortSelected.clear();V.shortSelected.add(x.id);
 showShortPanel();shortModalOpen();return true;
}
function editOneShortBox(key,line){return window.YoloCoords?.focusQCBox?.(key,line,'HEIGHT_LT_12PX');}
window.QCShortBoxes={open:openShortWarning,deleteOne:deleteOneShortBox,editOne:editOneShortBox};
document.getElementById('qcPreviewClose')?.addEventListener('click',()=>{document.getElementById('qcShortPreview').hidden=true;});
function showQcActionFeedback(text){
 const feedback=document.getElementById('qcActionFeedback');feedback.hidden=false;
 document.getElementById('qcActionFeedbackText').textContent=text;
}
document.getElementById('qcAfterEditedDownload').addEventListener('click',()=>$('shortDownload').click());

function shortUpdateSelected(){
 const all=V.shortRows.length,selected=V.shortRows.filter(x=>V.shortSelected.has(x.id)).length;
 $('shortAll').checked=!!all&&all===selected;
 $('shortAll').indeterminate=selected>0&&selected<all;
 $('shortChosen').textContent=`Đã chọn ${selected}/${all} box A vi phạm`;
 $('shortDelete').disabled=selected===0||V.shortScanning;
}
function applyShortAlerts(){
 const byImage=new Map;
 for(const x of V.shortRows){if(!byImage.has(x.key))byImage.set(x.key,[]);byImage.get(x.key).push(x);}
 for(const e of state.rows.filter(r=>r.matching)){
  if(e.shortWarningNote){e.data.notes=e.data.notes.replace(e.shortWarningNote,'').trim();e.shortWarningNote='';}
  if(e.shortWarningAlert){e.alerts=e.alerts.filter(w=>w!==e.shortWarningAlert);e.shortWarningAlert='';}
  const list=byImage.get(reviewKey(e))||[];
  if(!list.length)continue;
  const entries=list.map(x=>`A${x.line} ${x.className} (${x.height.toFixed(2)}px)`).join('; ');
  e.shortWarningAlert=`Nhãn sau sửa A có ${list.length} box cao dưới 12px: ${entries}.`;
  e.shortWarningNote=' [CẢNH BÁO A <12px: '+entries+']';
  e.alerts.push(e.shortWarningAlert);
  e.data.notes+=e.shortWarningNote;
 }
 render();
}
async function scanShortA(){
 const seq=++V.shortScanSeq;
 if(!state.after.length){V.shortRows=[];V.shortSelected.clear();V.shortScanning=false;showShortPanel();return;}
 const eligible=afterLabelRows().filter(e=>V.images.has(e.key));
 V.shortScanning=true;showShortPanel();
 let index=0;const rows=[],errors=[];
 const worker=async()=>{
  while(index<eligible.length){
   const e=eligible[index++],key=e.key,file=V.images.get(key);
   try{
    let rec=V.shortSizes.get(key);
    if(!rec||rec.file!==file){
      const img=key===V.key&&V.img&&file===V.images.get(V.key)?V.img:await decode(file);
      rec={file,width:img.naturalWidth,height:img.naturalHeight};V.shortSizes.set(key,rec);
    }
    if(seq!==V.shortScanSeq)return;
    for(const b of e.boxes){const height=b.g[3]*rec.height;
     if(height<SHORT_A_LIMIT-1e-8)rows.push({id:shortId(b,key),key,line:b.line,classId:b.c,className:shortLabel(b),height,raw:b.raw,g:b.g});
    }
   }catch(err){errors.push(key+': '+err.message);}
  }
 };
 await Promise.all(Array.from({length:Math.min(3,eligible.length)},worker));
 if(seq!==V.shortScanSeq)return;
 rows.sort((a,b)=>a.key.localeCompare(b.key,'vi')||a.line-b.line);
 V.shortRows=rows;const validIds=new Set(rows.map(x=>x.id));for(const id of V.shortSelected)if(!validIds.has(id))V.shortSelected.delete(id);
 V.shortScanning=false;showShortPanel();applyShortAlerts();
 if(errors.length){$('shortSummary').textContent+=' Không đọc được '+errors.length+' ảnh; kiểm tra lại tệp.';}
}
function shortModalOpen(){
 const chosen=V.shortRows.filter(x=>V.shortSelected.has(x.id));if(!chosen.length)return;
 $('shortConfirmInfo').textContent=`Bạn sắp xóa ${chosen.length} box A vi phạm trên ${new Set(chosen.map(x=>x.key)).size} ảnh. Thao tác chỉ có hiệu lực sau khi bấm “Xác nhận xóa box A”.`;
 $('shortConfirmList').textContent=chosen.map(x=>`${x.key} · A${x.line} · ${x.className} · ${x.height.toFixed(2)}px`).join('\n');
 $('shortModal').hidden=false;document.body.classList.add('shortAModalOpen');$('shortCancel').focus();
}
function shortModalClose(){
 $('shortModal').hidden=true;document.body.classList.remove('shortAModalOpen');$('shortDelete').focus();
}
function deleteSelectedA(){
 const chosen=V.shortRows.filter(x=>V.shortSelected.has(x.id));
 if(!chosen.length){shortModalClose();return;}
 try{
  // QC must work with the A labels alone; loading B or running compare is not required.
  if(!state.valid||!state.prepared||chosen.some(x=>!state.rows.some(r=>r.matching&&reviewKey(r)===x.key))){
   const files=nameMap(state.after),byId=new Map,planned=[];
   for(const x of chosen){if(!byId.has(x.key))byId.set(x.key,[]);byId.get(x.key).push(x);}
   for(const [key,list] of byId){
    const original=files.get(key);if(!original)throw Error(`Không tìm thấy nhãn A: ${key}`);
    const originals=original.text.replace(/^\uFEFF/,'').split(/\r?\n/),deleted=new Set(list.map(x=>x.line));
    for(const x of list)if(originals[x.line-1]?.trim()!==x.raw)throw Error(`${key}: nhãn đã thay đổi, hãy kiểm tra lại.`);
    const revised=originals.filter((_,i)=>!deleted.has(i+1)).join('\n');
    planned.push({original,revised});
   }
   for(const {original,revised} of planned){const index=state.after.indexOf(original);state.after[index]={...original,text:revised};}
   V.deletedA.push(...chosen.map(x=>({image_id:x.key,after_line_original:x.line,class_id:x.classId,class_name:x.className,height_px:x.height.toFixed(2),original_label:x.raw})));
   invalidate();updateCounts();shortModalClose();V.shortSelected.clear();
   window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after'}}));
   void scanShortA().then(()=>{showQcActionFeedback(`Đã xóa ${chosen.length} box A có xác nhận. Nhãn A trong phiên làm việc đã cập nhật. Muốn đối chiếu B–A, hãy chạy so sánh sau.`);});
   return;
  }
  const files=nameMap(state.after),grouped=new Map;
  for(const x of chosen){if(!grouped.has(x.key))grouped.set(x.key,[]);grouped.get(x.key).push(x);}
  const plans=[];
  // Chuẩn bị toàn bộ dữ liệu TRƯỚC khi cập nhật, tránh xóa dở nếu gặp lỗi.
  for(const [key,list] of grouped){
   const e=state.rows.find(r=>r.matching&&reviewKey(r)===key),file=files.get(key);
   if(!e||!file)throw Error('Không tìm thấy nhãn A đang chọn: '+key);
   const deleted=new Set(list.map(x=>x.line)),rawLines=file.text.replace(/^\uFEFF/,'').split(/\r?\n/);
   for(const x of list)if(!e.matching.b.some(b=>b.line===x.line)||rawLines[x.line-1]?.trim()!==x.raw)throw Error(key+': nhãn A thay đổi trong lúc xác nhận.');
   const lineMap=new Map;let dropped=0;
   const cleaned=rawLines.filter((_,i)=>{const line=i+1;if(deleted.has(line)){dropped++;return false;}lineMap.set(line,line-dropped);return true;});
   const nextFile={...file,text:cleaned.join('\n')};
   const result=prepareLabelFile(nextFile,key,document.getElementById('autoClamp').checked),nextBoxes=parseLabels(result.file,true);
   const prior=state.matchReviews.get(key);
   const decisions=prior?{
    links:prior.links.filter(p=>lineMap.has(p.after_line)).map(p=>({...p,after_line:lineMap.get(p.after_line)})),
    removed:[...prior.removed],
    added:prior.added.filter(l=>lineMap.has(l)).map(l=>lineMap.get(l)),
    rejected:prior.rejected.filter(p=>lineMap.has(p.after_line)).map(p=>({...p,after_line:lineMap.get(p.after_line)}))
   }:null;
   diff(e.matching.a,nextBoxes,e.matching.threshold,result.clamped,decisions);
   plans.push({key,e,file,nextFile,result,nextBoxes,decisions,deleted,lineMap,list});
  }
  const updated=new Set;
  const currentSelectedLine=entry()?.matching?.b[V.next]?.line;
  for(const p of plans){
   const i=state.after.indexOf(p.file);if(i<0)throw Error('Không tìm thấy tệp nhãn đang xử lý.');
   state.after[i]=p.nextFile;
   state.prepared.map.set(p.key,p.result.file);state.prepared.clampedLines.set(p.key,p.result.clamped);
   state.prepared.changes=state.prepared.changes.filter(x=>x.image_id!==p.key).concat(p.result.changes);
   p.e.matching.b=p.nextBoxes;p.e.matching.clampedLines=p.result.clamped;
   if(p.decisions)state.matchReviews.set(p.key,p.decisions);
   p.e.finalCount=p.nextBoxes.length;
   p.e.data.review_status='';
   if(V.key===p.key){
    const oldLine=currentSelectedLine;V.next=p.lineMap.get(oldLine)===undefined?-1:p.nextBoxes.findIndex(b=>b.line===p.lineMap.get(oldLine));
    if(V.next<0)V.next=p.nextBoxes.length?0:-1;
    V.hiddenA.clear();
   }
   updateRow(p.e);
   const summary=` [Đã xác nhận xóa ${p.list.length} box A dưới 12px: ${p.list.map(x=>'A'+x.line+' '+x.className+' '+x.height.toFixed(2)+'px').join('; ')}.]`;
   p.e.data.notes+=summary;
   V.deletedA.push(...p.list.map(x=>({image_id:x.key,after_line_original:x.line,class_id:x.classId,class_name:x.className,height_px:x.height.toFixed(2),original_label:x.raw})));
   updated.add(p.key);
  }
  invalidateEvaluation();
  // Existing prepared data and decisions have been updated; exports now use new A labels.
  shortModalClose();V.shortSelected.clear();
  window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after'}}));
  refreshView();scanShortA();
  window.YoloCoords?.refresh?.();
  message(`Đã xóa ${chosen.length} box A dưới 12px trên ${updated.size} ảnh. Đã cập nhật thống kê và CSV; hãy tải nhãn A mới để lưu.`);
  showQcActionFeedback(`Đã xóa ${chosen.length} box A có xác nhận; kết quả đối chiếu B–A đã cập nhật. Hãy tải nhãn A mới để lưu.`);
 }catch(error){$('shortConfirmInfo').textContent='Không thể xóa: '+error.message;}
}
function shortAuditEntries(){return V.deletedA.length?[{name:'deleted_short_boxes_A.csv',data:csv(['image_id','after_line_original','class_id','class_name','height_px','original_label'],V.deletedA)}]:[];}
$('shortAll').onchange=e=>{if(e.target.checked)for(const x of V.shortRows)V.shortSelected.add(x.id);else V.shortSelected.clear();showShortPanel();};
$('shortDelete').onclick=shortModalOpen;
$('shortCancel').onclick=shortModalClose;
$('shortConfirm').onclick=deleteSelectedA;
$('shortDownload').onclick=()=>renameDownload('after');
$('shortModal').addEventListener('click',event=>{if(event.target===$('shortModal'))shortModalClose();});
document.addEventListener('keydown',event=>{
 if($('shortModal').hidden)return;
 if(event.key==='Escape'){event.preventDefault();shortModalClose();}
 if(event.key==='Tab'){
  const nodes=[$('shortCancel'),$('shortConfirm')],first=nodes[0],last=nodes[1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
},true);
window.addEventListener('yolo:images-updated',()=>{void scanShortA();});
window.addEventListener('yolo:labels-updated',()=>{document.getElementById('qcActionFeedback').hidden=true;void scanShortA();});
document.getElementById('normalize')?.addEventListener('change',()=>{void scanShortA();});
setTimeout(()=>{void scanShortA();},0);

// After a reviewer confirms a decision, keep the same image and select the next
// still-unresolved box. Work from the recalculated matching, never from stale
// dropdown indices (manual decisions can change the automatic pair mapping).
function nextPending(e,kind,previousBefore,previousAfter){
 const pendingBefore=pendingBoxes(e,'before');
 const pendingAfter=pendingBoxes(e,'after');
 const nextIndex=(pending,current)=>pending.find(i=>i>current)??pending[0]??-1;
 const chooseBefore=()=>{const index=nextIndex(pendingBefore,previousBefore);if(index<0)return false;
  V.old=index;V.next=-1;
  const proposals=candidateRows(e);V.next=proposals[0]?.j??-1;
  return true;
 };
 const chooseAfter=()=>{const index=nextIndex(pendingAfter,previousAfter);if(index<0)return false;
  V.old=-1;V.next=index;return true;
 };
 const found=kind==='add'?(chooseAfter()||chooseBefore()):(chooseBefore()||chooseAfter());
 if(!found){V.old=-1;V.next=-1;}
 if(V.old>=0)V.hiddenB.delete(V.old);
 if(V.next>=0)V.hiddenA.delete(V.next);
 const label=V.old>=0?'B'+e.matching.a[V.old].line:'A'+e.matching.b[V.next]?.line;
 return {found,label,remaining:pendingBefore.length+pendingAfter.length};
}
function apply(kind){try{const e=guard();if(!V.img)throw Error('Tải ảnh gốc để kiểm tra trực quan trước khi xác nhận.');if(V.imgAfter&&(V.imgAfter.naturalWidth!==V.img.naturalWidth||V.imgAfter.naturalHeight!==V.img.naturalHeight))throw Error('Ảnh trước/sau khác kích thước. Chọn đúng ảnh gốc tương ứng trước khi xác nhận.');const {a,b}=selected(e),r=JSON.parse(JSON.stringify(review()));
 if(kind==='pin'){if(!a||!b)throw Error('Chọn một box B và một box A.');const existing=r.links.find(p=>p.before_line===a.line||p.after_line===b.line);
 if(existing&&(existing.before_line!==a.line||existing.after_line!==b.line))throw Error('Box đã thuộc cặp xác nhận. Gỡ cặp đó trước khi ghép lại.');
 if(!existing)r.links.push({before_line:a.line,after_line:b.line});r.removed=r.removed.filter(l=>l!==a.line);r.added=r.added.filter(l=>l!==b.line);r.rejected=r.rejected.filter(p=>p.before_line!==a.line||p.after_line!==b.line);}
 if(kind==='unlink'){if(!a)throw Error('Chọn box B.');const pair=e.matching.res.pairs.find(p=>p[0]===V.old);if(!pair)throw Error('Box B đang chọn chưa được ghép.');const line=e.matching.b[pair[1]].line;r.links=r.links.filter(p=>p.before_line!==a.line);if(!r.rejected.some(p=>p.before_line===a.line&&p.after_line===line))r.rejected.push({before_line:a.line,after_line:line});}
 if(kind==='remove'){if(!a)throw Error('Chọn box B đã xóa.');r.links=r.links.filter(p=>p.before_line!==a.line);if(!r.removed.includes(a.line))r.removed.push(a.line);}
 if(kind==='add'){if(!b)throw Error('Chọn box A mới thêm.');r.links=r.links.filter(p=>p.after_line!==b.line);if(!r.added.includes(b.line))r.added.push(b.line);}
 mergeManualMatches(e.matching.a,e.matching.b,e.matching.res.pairs,r);
 const oldBefore=V.old,oldAfter=V.next;
 state.matchReviews.set(reviewKey(e),r);updateRow(e);
 const autoAdvance=['pin','remove','add'].includes(kind)&&$('autoNext').checked;
 const advance=autoAdvance?nextPending(e,kind,oldBefore,oldAfter):null;
 refreshView();
 if(advance?.found)focusSelectedBox(kind==='add'?'after':'before');
 const base='Đã lưu quyết định và cập nhật review_log.';
 if(advance?.found)message(base+' Đã tự chuyển sang '+advance.label+' chưa ghép ('+advance.remaining+' box còn chờ xác nhận).');
 else if(advance&&!advance.found)message(base+' Không còn box chưa ghép ở ảnh này; các cặp tự động vẫn có thể kiểm tra.');
 else message(base+' Kiểm tra notes, thời gian và trạng thái trước khi xuất.');
 }catch(error){message(error.message,true);}}
function candidateRows(e){if(V.old<0)return[];const {pb,pa}=maps(e),r=review(),unresolved=$('onlyUnmatched').checked,a=e.matching.a[V.old];if(!a||r.removed.includes(a.line)||pb.get(V.old)?.manual||(unresolved&&pb.has(V.old)))return[];return e.matching.b.map((b,j)=>({j,...spatialCandidate(a,b)})).filter(x=>{const b=e.matching.b[x.j],pair=pa.get(x.j);return !r.added.includes(b.line)&&!pair?.manual&&!r.rejected.some(p=>p.before_line===a.line&&p.after_line===b.line)&&(!unresolved||!pair);}).sort((x,y)=>y.rank-x.rank||x.j-y.j).slice(0,20);}
function populateSelects(e){const {pb,pa}=maps(e);for(const [side,boxes,pairs,value] of [['before',e.matching.a,pb,V.old],['after',e.matching.b,pa,V.next]]){const select=$(side+'Select');select.replaceChildren();const none=node('option','Chưa chọn');none.value='-1';select.append(none);boxes.forEach((b,i)=>{const p=pairs.get(i),op=node('option',`${side==='before'?'B':'A'}${b.line} | ${name(b)} | ${p?'P'+p.p+(p.manual?' xác nhận':' tự động'):'chưa ghép'}`);op.value=String(i);select.append(op);});select.value=String(value);}}
function renderStats(e){const r=e.matching.res,ub=pendingBoxes(e,'before').length,ua=pendingBoxes(e,'after').length;const parts=[['Cũ / mới',e.matching.a.length+' / '+e.matching.b.length],['Đã ghép',r.pairs.length],['Thêm (đề xuất)',r.counts.boxes_added],['Xóa (đề xuất)',r.counts.boxes_removed],['Box đã sửa',r.counts.boxes_modified],['Chưa xác nhận thêm/xóa',ub+' / '+ua]];$('stats').replaceChildren(...parts.map(([title,value])=>{const n=node('div');n.append(node('strong',value),node('span',title));return n;}));}
function renderLists(e){const {pb,pa}=maps(e),r=review();for(const [side,boxes,pairs,hidden,prefix,selectedIndex] of [['before',e.matching.a,pb,V.hiddenB,'B',V.old],['after',e.matching.b,pa,V.hiddenA,'A',V.next]]){const body=$(side+'List'),classSelect=$(side+'Class'),previous=classSelect.value||'all';classSelect.replaceChildren();const any=node('option','Tất cả lớp');any.value='all';classSelect.append(any);for(const c of [...new Set(boxes.map(b=>b.c))].sort((a,b)=>a-b)){const op=node('option',name({c}));op.value=String(c);classSelect.append(op);}classSelect.value=[...new Set(boxes.map(b=>String(b.c)))].includes(previous)?previous:'all';const status=$(side+'Status').value||'all',cls=classSelect.value,q=$(side+'Search').value.trim().toUpperCase();body.replaceChildren();let count=0;boxes.forEach((b,index)=>{const pair=pairs.get(index),verified=(side==='before'?r.removed:r.added).includes(b.line),kind=pair?(pair.manual?'manual':'auto'):verified?'confirmed':'unmatched';if($('onlyUnmatched').checked&&kind!=='unmatched')return;if(status!=='all'&&(status==='matched'?!pair:kind!==status))return;if(cls!=='all'&&String(b.c)!==cls)return;if(q&&String(b.line)!==q&&prefix+b.line!==q)return;count++;const tr=node('tr');if(index===selectedIndex)tr.className='matchSelected';const td=node('td'),check=node('input');check.type='checkbox';check.checked=!hidden.has(index);check.setAttribute('aria-label','Hiện '+prefix+b.line);check.onchange=()=>{check.checked?hidden.delete(index):hidden.add(index);draw();};td.append(check);tr.append(td,node('td',prefix+b.line),node('td',name(b)));tr.append(node('td',pair?'P'+pair.p+' → '+(side==='before'?'A'+e.matching.b[pair.other].line:'B'+e.matching.a[pair.other].line)+(pair.manual?' (đã xác nhận)':' (tự động)'):verified?(side==='before'?'Đã xác nhận xóa':'Đã xác nhận thêm'):'Chưa ghép'));const button=node('button','Xem');button.onclick=()=>choose(side,index);const action=node('td');action.append(button);tr.append(action);body.append(tr);});$(side+'Count').textContent=`Hiện ${count} / ${boxes.length} box`;if(!count){const tr=node('tr'),td=node('td','Không có box phù hợp bộ lọc.');td.colSpan=5;tr.append(td);body.append(tr);}}}

function renderCandidates(e){const body=$('candidates');body.replaceChildren();const {pa}=maps(e),a=e.matching.a[V.old];if(!a){const tr=node('tr'),td=node('td','Chọn một box cũ B để xem ứng viên.');td.colSpan=7;tr.append(td);body.append(tr);return;}const w=V.img?.naturalWidth||1,h=V.img?.naturalHeight||1,diag=Math.hypot(w,h);const candidates=candidateRows(e);if(!candidates.length){const {pb}=maps(e),r=review(),resolved=r.removed.includes(a.line)||pb.get(V.old)?.manual;const tr=node('tr'),td=node('td',resolved?'Box B này đã được quyết định. Chọn box B chưa xử lý để xem đề xuất.':pb.has(V.old)&&$('onlyUnmatched').checked?'Box B này đã ghép tự động. Gỡ ghép nếu sai hoặc bỏ bộ lọc để xem các ứng viên chưa được xác nhận.':'Không còn ứng viên phù hợp chưa được quyết định.');td.colSpan=7;tr.append(td);body.append(tr);return;}for(const c of candidates){const b=e.matching.b[c.j],tr=node('tr');if(c.j===V.next)tr.className='matchSelected';const distance=Math.hypot((a.g[0]-b.g[0])*w,(a.g[1]-b.g[1])*h)/diag*100,pair=pa.get(c.j);tr.append(node('td',`B${a.line} → A${b.line}`),node('td',name(a)+' → '+name(b)),node('td',c.iou.toFixed(4)),node('td',distance.toFixed(2)+'%'),node('td',(c.areaRatio*100).toFixed(1)+'%'),node('td',pair?'P'+pair.p+' với B'+e.matching.a[pair.other].line:'Chưa ghép'));const td=node('td'),button=node('button','Xem cặp');button.onclick=()=>{V.next=c.j;$('filter').value='selected';refreshView();focusSelectedBox('after');};td.append(button);tr.append(td);body.append(tr);}}
function choose(side,index){const e=entry();if(!e?.matching)return;const {pb,pa}=maps(e);if(side==='before'){V.old=index;const mapped=pb.get(index);if(mapped)V.next=mapped.other;else{V.next=-1;const candidates=candidateRows(e);V.next=candidates[0]?.j??-1;}}else{V.next=index;const mapped=pa.get(index);if(mapped)V.old=mapped.other;}if(V.old>=0)V.hiddenB.delete(V.old);if(V.next>=0)V.hiddenA.delete(V.next);refreshView();focusSelectedBox(side);}
function refreshView(){const e=entry();if(!e?.matching)return;
 $('stats').hidden=false;$('filters').hidden=false;
 $('stage').hidden=!V.img;
 $('reviewTools').hidden=!V.img;
 $('analysisFold').hidden=false;
 $('exportTools').hidden=false;
 populateSelects(e);renderStats(e);renderLists(e);renderCandidates(e);draw();}
function cropRegion(e){const {a,b}=selected(e),rects=[a,b].filter(Boolean).map(corners);if(!rects.length)return null;let x1=Math.min(...rects.map(r=>r[0])),y1=Math.min(...rects.map(r=>r[1])),x2=Math.max(...rects.map(r=>r[2])),y2=Math.max(...rects.map(r=>r[3]));const px=Math.max(.02,(x2-x1)*.25),py=Math.max(.02,(y2-y1)*.25);return [Math.max(0,x1-px),Math.max(0,y1-py),Math.min(1,x2+px),Math.min(1,y2+py)];}
function visible(side,index,e){if(V.hold)return index===(side==='before'?V.old:V.next);const hidden=side==='before'?V.hiddenB:V.hiddenA;if(hidden.has(index))return false;if(!$(side==='before'?'showBefore':'showAfter').checked)return false;const {pb,pa}=maps(e),paired=(side==='before'?pb:pa).has(index),filter=$('filter').value;const box=(side==='before'?e.matching.a:e.matching.b)[index];
 const decision=review(e),confirmed=(side==='before'?decision.removed:decision.added).includes(box.line);
 const pending=!paired&&!confirmed;
 if($('onlyUnmatched').checked&&!pending)return false;
 return filter==='all'||(filter==='selected'&&index===(side==='before'?V.old:V.next))||(filter==='unmatched'&&pending)||(filter==='matched'&&paired);}
function lineBox(ctx,b,width,height,color,dashed,selected,label,showNumber){const [x1,y1,x2,y2]=corners(b);if(selected)color=dashed?'#bc087b':'#008b68';ctx.strokeStyle=color;ctx.lineWidth=selected?5:1.4;ctx.setLineDash(dashed?[7,4]:[]);ctx.strokeRect(x1*width,y1*height,(x2-x1)*width,(y2-y1)*height);if(selected){ctx.fillStyle=dashed?'rgba(225,0,145,.24)':'rgba(0,185,135,.24)';ctx.fillRect(x1*width,y1*height,(x2-x1)*width,(y2-y1)*height);}if(showNumber){ctx.setLineDash([]);ctx.font='12px Arial';const x=Math.max(0,Math.min(width-70,x1*width)),y=Math.max(15,y1*height);ctx.fillStyle=color;ctx.fillRect(x,y-14,ctx.measureText(label).width+6,16);ctx.fillStyle='white';ctx.fillText(label,x+3,y-2);}}
// Mục 04 uses a viewport camera rather than allocating a giant canvas at high zoom.
// Source coordinates stay normalized; reviews, labels, and exported data are untouched.
const MAX_MATCH_ZOOM=32;
const clamp01=(n,min,max)=>Math.min(max,Math.max(min,n));
function clampCamera(){
 const pad=.5/V.zoom;
 V.cx=clamp01(V.cx,pad,1-pad);
 V.cy=clamp01(V.cy,pad,1-pad);
}
function focusPoint(event,canvas){
 const rect=canvas.getBoundingClientRect();
 const cx=Number.isFinite(event.clientX)?event.clientX:rect.left+rect.width/2;
 const cy=Number.isFinite(event.clientY)?event.clientY:rect.top+rect.height/2;
 return {x:clamp01((cx-rect.left)/Math.max(1,rect.width),0,1),y:clamp01((cy-rect.top)/Math.max(1,rect.height),0,1)};
}
function toSource(canvas,event){
 const p=focusPoint(event,canvas);
 return {x:V.cx+(p.x-.5)/V.zoom,y:V.cy+(p.y-.5)/V.zoom};
}
function zoomLabel(){return V.zoom<=1.0001?'Vừa khung':Math.round(V.zoom*100)+'%';}
function syncZoomTool(){
 const btn=$('zoomTool');
 btn.classList.toggle('is-active',V.zoomMode);
 btn.setAttribute('aria-pressed',String(V.zoomMode));
 btn.textContent='⌕ Zoom · '+zoomLabel();
 btn.title='Z: bật/tắt zoom · +/−: phóng to/thu nhỏ · 0: vừa khung · cuộn chuột/trackpad: zoom · kéo để di chuyển';
}
function changeZoom(zoom,canvas=null,event=null){
 if(!V.img)return;
 const next=clamp01(Number(zoom)||1,1,MAX_MATCH_ZOOM);
 if(Math.abs(next-V.zoom)<1e-7)return;
 const p=canvas&&event?focusPoint(event,canvas):{x:.5,y:.5};
 const anchorX=V.cx+(p.x-.5)/V.zoom,anchorY=V.cy+(p.y-.5)/V.zoom;
 V.zoom=next;
 V.cx=anchorX+(.5-p.x)/next;V.cy=anchorY+(.5-p.y)/next;
 clampCamera();syncZoomTool();draw();
}
function resetZoom(){V.zoom=1;V.cx=V.cy=.5;syncZoomTool();draw();}
function toggleZoomTool(){
 V.zoomMode=!V.zoomMode;
 if(V.zoomMode){if(V.zoom===1)changeZoom(1.8);}else resetZoom();
 syncZoomTool();
}
function panBy(canvas,dx,dy){
 if(V.zoom===1)return;
 const rect=canvas.getBoundingClientRect();
 V.cx-=dx/(Math.max(1,rect.width)*V.zoom);
 V.cy-=dy/(Math.max(1,rect.height)*V.zoom);
 clampCamera();draw();
}
function focusSelectedBox(side='before'){
 if(V.zoom<=1)return;
 const e=entry();if(!e?.matching)return;
 const b=side==='after'?(e.matching.b[V.next]||e.matching.a[V.old]):(e.matching.a[V.old]||e.matching.b[V.next]);if(!b)return;
 V.cx=b.g[0];V.cy=b.g[1];clampCamera();draw();
}
function drawBoxInViewport(ctx,b,width,height,color,dashed,selected,label,showNumber){
 const [x1,y1,x2,y2]=corners(b);
 const left=V.cx-.5/V.zoom,top=V.cy-.5/V.zoom;
 const x=(x1-left)*width*V.zoom,y=(y1-top)*height*V.zoom;
 const rw=(x2-x1)*width*V.zoom,rh=(y2-y1)*height*V.zoom;
 if(x>width||y>height||x+rw<0||y+rh<0)return;
 if(selected)color=dashed?'#bc087b':'#008b68';
 ctx.strokeStyle=color;ctx.lineWidth=selected?4:1.4;
 ctx.setLineDash(dashed?[7,4]:[]);ctx.strokeRect(x,y,rw,rh);
 if(selected){ctx.fillStyle=dashed?'rgba(225,0,145,.24)':'rgba(0,185,135,.24)';ctx.fillRect(x,y,rw,rh);}
 if(showNumber){
  ctx.setLineDash([]);ctx.font='12px Arial';
  const tx=Math.max(0,Math.min(width-70,x)),ty=Math.max(15,Math.min(height,y));
  ctx.fillStyle=color;const labelWidth=ctx.measureText(label).width;
  ctx.fillRect(tx,ty-14,labelWidth+6,16);ctx.fillStyle='white';ctx.fillText(label,tx+3,ty-2);
 }
}
function paint(canvas,img,sides,e){
 const context=canvas.getContext('2d');
 if(!img){canvas.width=700;canvas.height=220;context.clearRect(0,0,700,220);return;}
 const pane=canvas.parentElement,cssWidth=Math.max(240,pane.clientWidth-2),cssHeight=cssWidth*img.naturalHeight/img.naturalWidth;
 // Device pixel ratio and canvas allocation are bounded for large source photos.
 const dpr=Math.max(.25,Math.min(window.devicePixelRatio||1,8192/cssWidth,8192/cssHeight,Math.sqrt(7500000/(cssWidth*cssHeight))));
 canvas.style.width=cssWidth+'px';canvas.style.height=cssHeight+'px';
 const backingWidth=Math.max(1,Math.round(cssWidth*dpr)),backingHeight=Math.max(1,Math.round(cssHeight*dpr));
 if(canvas.width!==backingWidth)canvas.width=backingWidth;
 if(canvas.height!==backingHeight)canvas.height=backingHeight;
 context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,cssWidth,cssHeight);
 const sw=img.naturalWidth/V.zoom,sh=img.naturalHeight/V.zoom;
 context.drawImage(img,(V.cx-.5/V.zoom)*img.naturalWidth,(V.cy-.5/V.zoom)*img.naturalHeight,sw,sh,0,0,cssWidth,cssHeight);
 const {pb,pa}=maps(e);
 for(const side of sides){const boxes=side==='before'?e.matching.a:e.matching.b,pairs=side==='before'?pb:pa;
 boxes.map((b,index)=>({b,index})).sort((x,y)=>Number(x.index===(side==='before'?V.old:V.next))-Number(y.index===(side==='before'?V.old:V.next))).forEach(({b,index})=>{
  if(!visible(side,index,e))return;const pair=pairs.get(index),label=(side==='before'?'B':'A')+b.line+(pair?' P'+pair.p:'');
  drawBoxInViewport(context,b,cssWidth,cssHeight,side==='before'?'#164acb':'#ad5700',side==='after',index===(side==='before'?V.old:V.next),label,$('numbers').checked);
 });}
 if(sides.length===2&&$('links').checked){context.strokeStyle='#515b69';context.lineWidth=1;context.setLineDash([3,4]);
  for(const [i,j] of e.matching.res.pairs){if(!visible('before',i,e)||!visible('after',j,e))continue;
   context.beginPath();context.moveTo((e.matching.a[i].g[0]-(V.cx-.5/V.zoom))*cssWidth*V.zoom,(e.matching.a[i].g[1]-(V.cy-.5/V.zoom))*cssHeight*V.zoom);
   context.lineTo((e.matching.b[j].g[0]-(V.cx-.5/V.zoom))*cssWidth*V.zoom,(e.matching.b[j].g[1]-(V.cy-.5/V.zoom))*cssHeight*V.zoom);context.stroke();
  }
 }
 context.setLineDash([]);
}
function paintCrop(canvas,img,box,region,color,dashed){const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;context.clearRect(0,0,w,h);if(!img||!box||!region){context.fillStyle='#526071';context.font='14px Arial';context.fillText('Chọn ảnh và box để xem chi tiết.',15,40);return;}const [x1,y1,x2,y2]=region,sw=(x2-x1)*img.naturalWidth,sh=(y2-y1)*img.naturalHeight;if(sw<=0||sh<=0)return;const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale,dx=(w-dw)/2,dy=(h-dh)/2;context.drawImage(img,x1*img.naturalWidth,y1*img.naturalHeight,sw,sh,dx,dy,dw,dh);const r=corners(box);context.strokeStyle=color;context.lineWidth=3;context.setLineDash(dashed?[7,4]:[]);context.strokeRect(dx+(r[0]-x1)*img.naturalWidth*scale,dy+(r[1]-y1)*img.naturalHeight*scale,(r[2]-r[0])*img.naturalWidth*scale,(r[3]-r[1])*img.naturalHeight*scale);context.setLineDash([]);}
function draw(){const e=entry();if(!e?.matching||!V.img)return;const mode=$('view').value;$('stage').classList.toggle('split',mode==='split');$('afterPane').hidden=mode!=='split';$('beforeTitle').textContent=mode==='before'?'Nhãn ban đầu B':mode==='after'?'Nhãn sau sửa A':mode==='split'?'Nhãn ban đầu B':'Chồng khung B (xanh) / A (cam)';paint($('canvasBefore'),mode==='after'?(V.imgAfter||V.img):V.img,mode==='before'||mode==='split'?['before']:mode==='after'?['after']:['before','after'],e);if(mode==='split')paint($('canvasAfter'),V.imgAfter||V.img,['after'],e);const {a,b}=selected(e),region=cropRegion(e);paintCrop($('cropBefore'),V.img,a,region,'#164acb',false);paintCrop($('cropAfter'),V.imgAfter||V.img,b,region,'#ad5700',true);for(const [side,box] of [['before',a],['after',b]]){$(side+'Info').textContent=box?`Dòng ${box.line} | ${name(box)}\nYOLO: ${box.raw}`:'Chưa chọn box.';}if(a&&b)$('afterInfo').textContent+=`\nIoU với B${a.line}: ${iou(a,b).toFixed(6)}. Chỉ số này không chứng minh cùng phương tiện.`;}
async function decode(file){const url=URL.createObjectURL(file);return new Promise((resolve,reject)=>{const img=new Image;img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Không mở được ảnh '+file.name))};img.src=url;});}
async function openImage(){endHold();resetZoom();const seq=++V.seq;V.key=$('imageSelect').value;V.hiddenB.clear();V.hiddenA.clear();const e=entry();V.old=-1;V.next=-1;V.img=null;V.imgAfter=null;if(!e?.matching){message('Chạy So sánh nhãn trước để tạo danh sách ảnh.');return;}const f=V.images.get(V.key),fa=V.imagesAfter.get(V.key);try{const base=f?await decode(f):null;if(seq!==V.seq)return;const next=fa?await decode(fa):null;if(seq!==V.seq)return;V.img=base;V.imgAfter=next;const {pb}=maps(e);V.old=pendingBoxes(e,'before')[0]??($('onlyUnmatched').checked?-1:e.matching.a.length?0:-1);const mapped=pb.get(V.old);V.next=mapped?mapped.other:-1;if(V.next<0)V.next=candidateRows(e)[0]?.j??(V.old<0?pendingBoxes(e,'after')[0]??-1:-1);refreshView();if(!V.img)message('Chưa có ảnh gốc cho '+V.key+'. Tải ảnh cùng ID. Bạn vẫn xem được danh sách dòng nhãn.',true);else if(V.imgAfter&&(V.imgAfter.naturalWidth!==V.img.naturalWidth||V.imgAfter.naturalHeight!==V.img.naturalHeight))message('Ảnh trước/sau khác kích thước; cần dùng đúng ảnh gốc. Chưa cho xác nhận ghép.',true);else message('B là nhãn ban đầu; A là nhãn sau chuẩn bị/cắt biên nếu bật. Chọn cặp để xem hai vùng phóng lớn. Tự động ghép chưa phải xác nhận của người rà soát.');}catch(error){if(seq!==V.seq)return;V.img=null;V.imgAfter=null;$('stage').hidden=true;$('reviewTools').hidden=true;message(error.message,true);}}
function refresh(){const prior=V.key;$('imageSelect').replaceChildren();$('imageIds').replaceChildren();for(const r of state.rows.filter(x=>x.matching)){const key=reviewKey(r),op=node('option',key);op.value=key;$('imageSelect').append(op);const hint=node('option');hint.value=key;$('imageIds').append(hint);}const options=state.rows.filter(x=>x.matching);if(!options.length){$('imageId').value='';stale();return;}V.key=options.some(r=>reviewKey(r)===prior)?prior:reviewKey(options[0]);$('imageSelect').value=V.key;$('imageId').value=V.key;openImage();scanShortA();}
function openImageById(){const input=$('imageId').value.trim();if(!input){$('imageId').value=$('imageSelect').value;void openImage();return;}const opts=[...$('imageSelect').options].map(x=>x.value).filter(Boolean);const exact=opts.find(id=>id===input);const matches=exact?[exact]:opts.filter(id=>id.toLowerCase().includes(input.toLowerCase()));if(matches.length!==1){message(matches.length?'Có '+matches.length+' ảnh khớp ID. Hãy nhập thêm ký tự hoặc chọn trực tiếp trong danh sách.':'Không tìm thấy image_id phù hợp. Kiểm tra nhãn B/A và chạy So sánh nhãn.',true);return;}$('imageSelect').value=matches[0];$('imageId').value=matches[0];void openImage();}

function stale(){V.shortScanSeq++;V.shortRows=[];V.shortSelected.clear();V.shortScanning=false;showShortPanel();V.seq++;V.img=null;V.imgAfter=null;V.zoomMode=false;resetZoom();
 $('stats').replaceChildren();$('stats').hidden=true;$('filters').hidden=true;
 $('stage').hidden=true;$('reviewTools').hidden=true;
 $('analysisFold').hidden=true;$('exportTools').hidden=true;
 message('Dữ liệu hoặc cấu hình đã đổi. Bấm So sánh nhãn phía trên rồi đối chiếu lại.');
 $('pin').disabled=$('remove').disabled=$('add').disabled=true;}
async function uploadImages(files,after){try{const target=after?V.imagesAfter:V.images,next=new Map,selected=Array.from(files).filter(f=>/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i.test(f.name));if(!selected.length)throw Error('Chọn ảnh JPG/PNG/WebP hợp lệ.');for(const f of selected){const key=keyOfImage(f.name);if(next.has(key))throw Error('Trùng ID ảnh sau chuẩn hóa: '+key);next.set(key,f);}for(const [key,f] of next)target.set(key,f);
 $('imageMeta').textContent=`Đã tải ${V.images.size} ảnh gốc và ${V.imagesAfter.size} ảnh sau riêng. ID ảnh: tự khớp với nhãn.`;
 if(!after)window.dispatchEvent(new CustomEvent('yolo:images-updated',{detail:{count:V.images.size,ids:[...V.images.keys()]}}));
 await openImage();return true;}catch(error){message(error.message,true);return false;}}
function pickFromCanvas(event,afterCanvas){if(V.suppressClick){V.suppressClick=false;return;}const e=entry();if(!V.img||!e?.matching)return;const canvas=event.currentTarget,p=toSource(canvas,event),side=afterCanvas?'after':['before','split'].includes($('view').value)?'before':$('view').value==='after'?'after':$('clickSide').value,boxes=side==='before'?e.matching.a:e.matching.b;const hits=boxes.map((box,i)=>({box,i,r:corners(box)})).filter(x=>visible(side,x.i,e)&&p.x>=x.r[0]&&p.x<=x.r[2]&&p.y>=x.r[1]&&p.y<=x.r[3]).sort((x,y)=>x.box.g[2]*x.box.g[3]-y.box.g[2]*y.box.g[3]);if(!hits.length){message('Điểm bấm không nằm trong box đang hiện. Chọn số dòng ở danh sách nếu khung bị chồng.');return;}choose(side,hits[0].i);if(hits.length>1)message('Có '+hits.length+' box tại điểm bấm. Đã chọn box nhỏ nhất; dùng danh sách số dòng để chọn khung khác.');}
$('images').onchange=e=>uploadImages(e.target.files,false);$('imageFolder').onchange=e=>uploadImages(e.target.files,false);$('imagesAfter').onchange=e=>uploadImages(e.target.files,true);$('open').onclick=openImageById;$('imageSelect').onchange=()=>{$('imageId').value=$('imageSelect').value;void openImage();};$('imageId').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();openImageById();}});
$('beforeSelect').onchange=()=>choose('before',Number($('beforeSelect').value));$('afterSelect').onchange=()=>{V.next=Number($('afterSelect').value);refreshView();focusSelectedBox('after');};$('showPair').onclick=()=>{$('onlyUnmatched').checked=false;$('filter').value='selected';refreshView();};
for(const id of ['view','showBefore','showAfter','numbers','links'])$(id).onchange=draw;
$('filter').onchange=()=>{
 $('onlyUnmatched').checked=$('filter').value==='unmatched';
 refreshView();
};
$('onlyUnmatched').onchange=()=>{
 const e=entry();if(!e?.matching)return;
 if($('onlyUnmatched').checked){
  $('filter').value='unmatched';
  for(const side of ['before','after'])$(side+'Status').value='all';
  nextPending(e,'pin',V.old,V.next);
 }else if($('filter').value==='unmatched')$('filter').value='all';
 refreshView();
};
for(const side of ['before','after']){const filterTable=()=>{const e=entry();if(e?.matching){renderLists(e);$(side+'List').closest?.('.matchList')?.scrollTo?.(0,0);}};for(const kind of ['Status','Class'])$(side+kind).onchange=filterTable;$(side+'Search').oninput=filterTable;$(side+'Clear').onclick=()=>{$(side+'Status').value='all';$(side+'Class').value='all';$(side+'Search').value='';filterTable();};}
function endHold(){if(V.holdTimer!==null){clearTimeout(V.holdTimer);V.holdTimer=null;}if(V.hold){V.hold=false;draw();}}
function eventCanvas(event){return event.currentTarget.closest('.matchPane')?.querySelector('canvas');}
function tryEndPointer(event){
 if(V.touches.has(event.pointerId))V.touches.delete(event.pointerId);
 if(V.touches.size<2&&V.pinch){V.pinch=null;setTimeout(()=>{V.suppressClick=false;},180);}
 if(V.panning?.id===event.pointerId){
  if(V.panning.moved){V.suppressClick=true;setTimeout(()=>{V.suppressClick=false;},180);}
  V.panning=null;
 }
 endHold();V.holdOrigin=null;
}
for(const id of ['canvasBefore','canvasAfter']){
 const c=$(id);c.tabIndex=0;c.setAttribute('aria-label','Ảnh đối chiếu, dùng Z để bật Zoom, +/− để phóng và kéo để di chuyển');
 c.addEventListener('mouseenter',()=>V.stageHover=true);
 c.addEventListener('mouseleave',()=>V.stageHover=false);
 c.addEventListener('pointerdown',event=>{
  if(!V.img||!entry()?.matching)return;
  if(event.button!==0&&event.button!==1)return;
  c.focus({preventScroll:true});endHold();V.suppressClick=false;
  if(event.pointerType==='touch'){
   V.touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
   c.setPointerCapture(event.pointerId);
   if(V.touches.size===2){
    const touch=[...V.touches.values()],distance=Math.hypot(touch[0].x-touch[1].x,touch[0].y-touch[1].y)||1;
    const mid={clientX:(touch[0].x+touch[1].x)/2,clientY:(touch[0].y+touch[1].y)/2};
    V.pinch={distance,zoom:V.zoom,anchor:toSource(c,mid),canvas:c};V.panning=null;V.suppressClick=true;
   }else if(V.zoom>1)V.panning={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,canvas:c};
   return;
  }
  V.holdOrigin={x:event.clientX,y:event.clientY};
  if(V.zoom>1||event.button===1||event.shiftKey){
   event.preventDefault();c.setPointerCapture(event.pointerId);
   V.panning={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,canvas:c};
   if(event.button===0)V.holdTimer=setTimeout(()=>{V.holdTimer=null;V.hold=true;V.suppressClick=true;draw();},600);
  }else if(event.button===0){
   c.setPointerCapture(event.pointerId);
   V.holdTimer=setTimeout(()=>{V.holdTimer=null;V.hold=true;V.suppressClick=true;draw();},600);
  }
 });
 c.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch'&&V.touches.has(event.pointerId)){
   V.touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
   if(V.pinch&&V.touches.size>=2){
    const touch=[...V.touches.values()],distance=Math.hypot(touch[0].x-touch[1].x,touch[0].y-touch[1].y)||1;
    const mid={clientX:(touch[0].x+touch[1].x)/2,clientY:(touch[0].y+touch[1].y)/2};
    const next=clamp01(V.pinch.zoom*distance/V.pinch.distance,1,MAX_MATCH_ZOOM);
    const p=focusPoint(mid,V.pinch.canvas);
    V.zoom=next;V.cx=V.pinch.anchor.x+(.5-p.x)/next;V.cy=V.pinch.anchor.y+(.5-p.y)/next;
    clampCamera();syncZoomTool();draw();event.preventDefault();return;
   }
  }
  if(V.panning?.id===event.pointerId){
   const moveX=event.clientX-V.panning.x,moveY=event.clientY-V.panning.y;
   if(Math.hypot(moveX,moveY)>1){V.panning.moved=true;if(V.holdOrigin&&Math.hypot(event.clientX-V.holdOrigin.x,event.clientY-V.holdOrigin.y)>8)endHold();panBy(V.panning.canvas,moveX,moveY);V.panning.x=event.clientX;V.panning.y=event.clientY;}
   if(V.panning.moved)event.preventDefault();
  }else if(V.holdOrigin&&Math.hypot(event.clientX-V.holdOrigin.x,event.clientY-V.holdOrigin.y)>8)endHold();
 });
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(ev,tryEndPointer);
 c.addEventListener('contextmenu',event=>event.preventDefault());
 c.addEventListener('wheel',event=>{
  if(!V.img||!entry()?.matching)return;
  if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)*1.5){
   if(V.zoom>1){event.preventDefault();panBy(c,-event.deltaX,-event.deltaY);}return;
  }
  // Plain wheel = mouse/trackpad zoom; Ctrl/⌘+wheel = trackpad pinch.
  event.preventDefault();changeZoom(V.zoom*Math.exp(-event.deltaY*(event.ctrlKey||event.metaKey?0.009:0.0025)),c,event);
 },{passive:false});
 c.addEventListener('gesturestart',event=>{if(!V.img)return;event.preventDefault();V.gesture={zoom:V.zoom,anchor:toSource(c,event)};},{passive:false});
 c.addEventListener('gesturechange',event=>{
  if(!V.gesture)return;event.preventDefault();const zoom=clamp01(V.gesture.zoom*event.scale,1,MAX_MATCH_ZOOM),p=focusPoint(event,c);
  V.zoom=zoom;V.cx=V.gesture.anchor.x+(.5-p.x)/zoom;V.cy=V.gesture.anchor.y+(.5-p.y)/zoom;
  clampCamera();syncZoomTool();draw();
 },{passive:false});
 c.addEventListener('gestureend',()=>V.gesture=null);
}
window.addEventListener('blur',()=>{endHold();V.panning=null;V.touches.clear();V.pinch=null;});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){endHold();if(V.zoomMode){V.zoomMode=false;syncZoomTool();}return;}
 if(event.repeat&&event.key.toLowerCase()==='z')return;
 if(!V.img||!entry()?.matching)return;
 const target=event.target;
 if(target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 const within=!!target?.closest?.('#matchSection')||V.stageHover||V.zoomMode;
 if(!within)return;
 const key=event.key.toLowerCase();
 if(key==='z'){event.preventDefault();toggleZoomTool();}
 else if(event.key==='+'||event.key==='='||event.code==='NumpadAdd'){
  event.preventDefault();V.zoomMode=true;changeZoom(V.zoom*1.25);syncZoomTool();
 }else if(event.key==='-'||event.key==='_'||event.code==='NumpadSubtract'){
  event.preventDefault();changeZoom(V.zoom/1.25);
 }else if(key==='0'){event.preventDefault();resetZoom();}
});
$('zoomTool').onclick=toggleZoomTool;syncZoomTool();
$('canvasBefore').addEventListener('click',e=>pickFromCanvas(e,false));$('canvasAfter').addEventListener('click',e=>pickFromCanvas(e,true));
for(const [id,kind] of [['pin','pin'],['unlink','unlink'],['remove','remove'],['add','add']])$(id).onclick=()=>apply(kind);
$('reset').onclick=()=>{try{const e=guard();state.matchReviews.delete(V.key);updateRow(e);refreshView();message('Đã bỏ quyết định thủ công của ảnh này và quay về kết quả tự động.');}catch(error){message(error.message,true);}};
$('export').onclick=()=>{try{if(!state.valid)throw Error('So sánh nhãn trước khi tải quyết định.');download('matching_decisions.json',new Blob([JSON.stringify(exportObject(),null,2)],{type:'application/json'}));}catch(error){message(error.message,true);}};
$('import').onchange=async event=>{try{if(!state.valid)throw Error('Chạy So sánh nhãn trước khi nạp quyết định.');const f=event.target.files[0];if(!f)return;if(f.size>20*1024*1024)throw Error('File quyết định quá lớn.');const data=JSON.parse(await f.text());if(!state.valid)throw Error('Dữ liệu đã đổi trong khi đọc file. So sánh lại trước khi nạp quyết định.');if(data.format!=='yolo_matching_review_v1'||!Array.isArray(data.images))throw Error('Không đúng định dạng quyết định ghép.');const plan=[],seen=new Set;for(const item of data.images){if(seen.has(item.image_id))throw Error('Trùng image_id trong file quyết định.');seen.add(item.image_id);const e=state.rows.find(r=>reviewKey(r)===item.image_id);if(!e?.matching)throw Error('Thiếu ảnh trong lần so sánh này: '+item.image_id);const sig=signature(e);if(JSON.stringify(sig.before_labels)!==JSON.stringify(item.before_labels)||JSON.stringify(sig.after_labels)!==JSON.stringify(item.after_labels))throw Error('Nhãn đã đổi hoặc đổi thứ tự dòng: '+item.image_id+'. Không nạp quyết định cũ.');for(const key of ['links','removed','added','rejected'])if(!Array.isArray(item.decisions?.[key]))throw Error('Thiếu danh sách quyết định '+key);mergeManualMatches(e.matching.a,e.matching.b,e.matching.res.pairs,item.decisions);plan.push([e,item.decisions]);}for(const [e,decision] of plan){state.matchReviews.set(reviewKey(e),decision);updateRow(e);}refreshView();message('Đã nạp và kiểm tra quyết định của '+plan.length+' ảnh.');}catch(error){message(error.message,true);}};
window.addEventListener('resize',()=>{if(V.img)draw();});
// Called by core after comparison. No input label is changed by this editor.
 function clearLoadedImages(kind){
  if(!['original','after'].includes(kind))throw Error('Loại ảnh không hợp lệ.');
  const target=kind==='after'?V.imagesAfter:V.images,removed=target.size;
  target.clear();V.seq++;V.shortScanSeq++;V.img=null;V.imgAfter=null;
  if(kind==='original'){V.shortRows=[];V.shortSelected.clear();V.shortScanning=false;showShortPanel();}
  $('imageMeta').textContent=`Đã tải ${V.images.size} ảnh gốc và ${V.imagesAfter.size} ảnh sau riêng.`;
  for(const id of kind==='original'?['images','imageFolder']:['imagesAfter']){const input=$(id);if(input)input.value='';}
  window.dispatchEvent(new CustomEvent('yolo:images-updated',{detail:{count:V.images.size,ids:[...V.images.keys()]}}));
  if(state.valid)void openImage();
  return removed;
 }
window.MatchReview={refresh,stale,clearLoadedImages,exportEntries,exportObject,shortAuditEntries,mergeManualMatches,spatialCandidate,listImageIds:()=>[...V.images.keys()].sort((a,b)=>a.localeCompare(b)),listAfterImageIds:()=>[...V.imagesAfter.keys()],listLoadedFileNames:kind=>[...(kind==='after'?V.imagesAfter:V.images).values()].map(file=>file._hubPath||file.webkitRelativePath||file.name),addAfterImages:files=>uploadImages(files,true),getImageFile:id=>V.images.get(id)||null,addImages:files=>uploadImages(files,false),updateAvailability(){const usable=!!entry()?.matching&&!!V.img&&!state.busy;for(const id of ['pin','remove','add'])$(id).disabled=!usable;}};
const originalRefresh=refreshView;refreshView=function(){originalRefresh();const usable=!!entry()?.matching&&!!V.img;for(const id of ['pin','remove','add'])$(id).disabled=!usable;};
})();
