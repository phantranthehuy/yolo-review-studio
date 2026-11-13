/* v4.1.8.4 — queued single upload, skip JSON, A/B role confirmation and QC. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const hub=$('uploadHub');if(!hub)return;
const getImages=()=>window.MatchReview?.listImageIds?.()||[];
const getAfterImages=()=>window.MatchReview?.listAfterImageIds?.()||[];
const hubRoleLabels={before:'B — nhãn ban đầu',after:'A — nhãn sau sửa',gold:'Nhãn tham chiếu / Ground Truth',intergroupSource:'Nhãn đã sửa của nhóm nguồn (intergroup)',member:'Nhãn thành viên (gộp tại mục 06)',skip:'Bỏ qua nhóm này'};
const status=(text,error=false)=>{const el=$('hubStatus');el.textContent=text;el.classList.toggle('hubError',error);};
function isLoaded(key){return ({before:state.before.length,after:state.after.length,images:getImages().length,gold:state.gold.length,afterImages:getAfterImages().length,manifest:state.manifest?.rows?.length||0,schema:state.schema?.length||0,classes:state.classes?.length||0,evalIds:state.evalIds?.rows?.length||0,decisions:state.matchReviews.size})[key]||0;}
// Preserve legacy input handlers, but the operator sees exactly one input surface.
for(const id of ['beforeFiles','beforeFolder','afterFiles','afterFolder','goldFiles','goldFolder','vm_images','vm_imagesAfter','vm_imageFolder','manifestFile','schemaFile','classesFile','evalIdsFile','vm_import','coord_labelFile','coord_file','coord_imageFolder']){
 const input=$(id);if(!input)continue;input.closest('label')?.classList.add('hubLegacyHide');input.classList.add('hubLegacyHide');
}
for(const id of ['goldImportZone','goldChoose','goldOptions','coord_imagePick','coord_labelPick'])$(id)?.classList.add('hubLegacyHide');
// Other coordinate tools remain: image ID and use existing B/A labels.
// Native <label for="..."> activation is essential for Safari's file/folder picker.
// Never programmatically click a hidden input in a mouse event; the browser owns it.
// The keyboard path is explicit because label role=button is focusable for accessibility.
for(const [labelId,inputId] of [['hubFileButton','hubAnyFiles'],['hubFolderButton','hubAnyFolder']]){
 const label=$(labelId),input=$(inputId);
 label.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  if(input.disabled){status('Đang xử lý dữ liệu. Hãy hoàn tất thao tác hiện tại.',true);return;}
  input.click();
 });
}

for(const [id,target] of [['hubClearBefore','[data-clear="before"]'],['hubClearAfter','[data-clear="after"]'],['hubExportBefore','#beforeZip'],['hubExportAfter','#afterZip']]){
 $(id).onclick=()=>{const el=document.querySelector(target);if(!el||el.disabled){status('Chưa có bộ nhãn tương ứng.',true);return;}el.click();refresh();};
}
// Separate intergroup source labels from A/B labels and original images.
$('hubClearSource').addEventListener('click',()=>{
 const service=window.YoloIntergroup;
 const summary=service?.getSummary?.();
 const amount=summary?.sourceTotal||0;
 if(!amount){status('Chưa có nhãn nhóm nguồn đã nạp.',true);refresh();return;}
 const decisions=summary?.reviewTotal||0;
 const warning=`Xóa ${amount} tệp nhãn đã sửa của nhóm nguồn khỏi phiên làm việc?`
  +(decisions?`\n\n${decisions} kết luận kiểm giữa nhóm đã lưu cũng sẽ được xóa vì không còn cơ sở đối chiếu.`:'')
  +'\n\nNhãn A, nhãn B, ảnh gốc, baseline và tệp trên máy không thay đổi.';
 if(!window.confirm(warning))return;
 const result=service.clearSource();
 status(`Đã xóa ${result.removed} nhãn nhóm nguồn khỏi phiên làm việc.`
  +(result.invalidated?` Đồng thời xóa ${result.invalidated} kết luận kiểm giữa nhóm để tránh sử dụng kết quả cũ.`:'')
  +' Nhãn A/B và ảnh gốc được giữ nguyên.');
 refresh();
});
// Scoped data clearing: never clear an unrelated dataset implicitly.
const scopedClearSpecs={
 hubClearIgBaseline:{role:'baseline',label:'nhãn baseline kiểm giữa nhóm',amount:'baselineTotal'},
 hubClearIgImages:{role:'image',label:'ảnh kiểm giữa nhóm',amount:'imageTotal'},
 hubClearIgAssignment:{role:'assign',label:'phân công kiểm giữa nhóm',amount:'assignmentTotal'},
 hubClearIgReviews:{role:'reviews',label:'kết luận kiểm giữa nhóm',amount:'reviewTotal'}
};
for(const [id,spec] of Object.entries(scopedClearSpecs)){
 $(id).addEventListener('click',()=>{
  const svc=window.YoloIntergroup,summary=svc?.getSummary?.(),amount=summary?.[spec.amount]||0;
  if(!amount){status('Chưa có '+spec.label+' đã nạp.',true);return;}
  const dependent=spec.role!=='reviews'?summary.reviewTotal:0;
  const confirmText=`Xóa ${amount} ${spec.label} khỏi phiên làm việc?`+(dependent?`\n\n${dependent} kết luận liên nhóm cũng sẽ được hủy để tránh dùng kết quả cũ.`:'')+'\n\nKhông xóa tệp trên máy; các nhóm dữ liệu khác được giữ nguyên.';
  if(!window.confirm(confirmText))return;
  const result=svc.clearRole(spec.role);
  status(`Đã xóa ${result.removed} ${spec.label}.`+(result.invalidated?` Đồng thời hủy ${result.invalidated} kết luận cũ.`:''));refresh();
 });
}
function confirmClear(label,count,impact,action){
 if(!count){status('Chưa có '+label+' đã nạp.',true);return;}
 if(!window.confirm(`Xóa ${count} ${label} khỏi phiên làm việc?\n\n${impact}\n\nKhông xóa tệp gốc trên máy.`))return;
 action();status(`Đã xóa ${count} ${label} khỏi phiên làm việc.`);refresh();
}
$('hubClearGold').onclick=()=>confirmClear('nhãn Ground Truth',state.gold.length,'Kết quả chấm Ground Truth cũ sẽ được hủy; nhãn A/B vẫn giữ nguyên.',()=>{
 state.gold=[];for(const id of ['goldFiles','goldFolder'])$(id).value='';$('goldCount').textContent='Chưa có nhãn tham chiếu';
 invalidateEvaluation();updateCounts();window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'gold'}}));
});
for(const [id,kind,label] of [['hubClearImages','original','ảnh gốc'],['hubClearAfterImages','after','ảnh sau riêng']]){
 $(id).onclick=()=>confirmClear(label,kind==='original'?getImages().length:getAfterImages().length,
  'Chỉ xóa ảnh thuộc bộ đã chọn. Các nhãn và ảnh kiểm giữa nhóm không thay đổi.',()=>window.MatchReview.clearLoadedImages(kind));
}
$('hubClearManifestData').onclick=()=>confirmClear('manifest',state.manifest?.rows?.length||0,'Phạm vi đối chiếu sẽ quay về toàn bộ dữ liệu A/B; kết quả đối chiếu cũ không còn hợp lệ.',()=>{
state.manifest=null;state.manifestEvidence=null;state.fileOrigins.manifest='';state.manifestScope='all';state.selectedMember='';$('manifestFile').value='';$('manifestName').textContent='Chưa có assignment_manifest.csv. Đang dùng ảnh của hai bộ nhãn.';
 invalidate();renderManifestMembers();window.dispatchEvent(new Event('yolo:manifest-updated'));
});
$('hubClearEvalIdsData').onclick=()=>confirmClear('danh sách ảnh chấm',state.evalIds?.rows?.length||0,'Lần chấm tiếp theo sẽ sử dụng toàn bộ nhãn A sau sửa.',()=>$('clearEvalIds').click());
$('hubClearSchemaData').onclick=()=>confirmClear('mẫu CSV log',state.schema?.length||0,'Mẫu log sẽ trở về 11 cột mặc định.',()=>$('clearSchema').click());
// Compact real-file captions immediately below each data-management button.
// No guessed names: all labels come from loaded File/ZIP entries or CSV metadata.
const managedSourceMap={
 hubClearBefore:'before',hubClearAfter:'after',hubClearGold:'gold',
 hubClearImages:'images',hubClearAfterImages:'afterImages',
 hubClearSource:'source',hubClearIgBaseline:'baseline',hubClearIgImages:'igImages',
 hubClearIgAssignment:'assignment',hubClearIgReviews:'reviews',
 hubClearManifestData:'manifest',hubClearEvalIdsData:'evalIds',hubClearSchemaData:'schema',
 hubExportBefore:'before',hubExportAfter:'after'
};
const managedCaption=new Map();
function setupManagedCaptions(){
 for(const button of document.querySelectorAll('.hubManageGroup .hubButtons > button')){
  const wrapper=document.createElement('div');wrapper.className='hubManagedAction';
  button.before(wrapper);wrapper.append(button);
  const caption=document.createElement('div');caption.className='hubFileCaption';
  caption.id='filename-'+button.id;caption.setAttribute('aria-live','polite');wrapper.append(caption);
  managedCaption.set(button.id,caption);
  button.setAttribute('aria-describedby',caption.id);
 }
}
function namesForManagedButton(id){
 const source=managedSourceMap[id];
 const ig=window.YoloIntergroup?.getLoadedFileNames?.()||{};
 const fromMain=key=>(state[key]||[]).map(file=>file.path||file._hubPath||file.name);
 switch(source){
  case 'before':case 'after':case 'gold':return fromMain(source);
  case 'images':return window.MatchReview?.listLoadedFileNames?.('original')||[];
  case 'afterImages':return window.MatchReview?.listLoadedFileNames?.('after')||[];
  case 'source':return ig.source||[];
  case 'baseline':return ig.baseline||[];
  case 'igImages':return ig.image||[];
  case 'assignment':return ig.assign||[];
  case 'reviews':return ig.reviews||[];
  case 'manifest':case 'evalIds':case 'schema':return state.fileOrigins?.[source]?[state.fileOrigins[source]]:[];
  default:return [];
 }
}
function updateManagedCaptions(){
 for(const [id,container] of managedCaption){
  const raw=namesForManagedButton(id).map(x=>String(x||'').trim()).filter(Boolean);
  const names=[...new Set(raw)].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
  const kind=id==='hubClearIgReviews'?'result':'files';
  const priorOpen=!!container.querySelector('details')?.open;
  container.replaceChildren();
  const line=document.createElement('span');line.className='hubFileSummary';
  if(!names.length){container.classList.add('hubFileEmpty');line.textContent='Chưa nạp';container.append(line);continue;}
  container.classList.remove('hubFileEmpty');
  if(kind==='result'){
   const n=window.YoloIntergroup?.getSummary?.()?.reviewTotal||0;
   line.textContent=n+' kết luận · tệp sẽ xuất: '+names[0];line.title=line.textContent;container.append(line);continue;
  }
  const first=names[0].replace(/^.*[\\/]/,'');
  line.textContent=names.length===1?first:`${names.length} tệp · ${first}`;
  line.title=names.length===1?names[0]:names.length+' tệp đã nạp; mở danh sách bên dưới để xem đầy đủ';
  container.append(line);
  if(names.length>1||names[0]!==first){
   const details=document.createElement('details');details.className='hubFileDetails';details.open=priorOpen;
   const summary=document.createElement('summary');summary.textContent=names.length===1?'Xem đường dẫn':'Xem đủ '+names.length+' tên tệp';details.append(summary);
   const list=document.createElement('div');list.className='hubFileNameList';
   for(const name of names){const item=document.createElement('div');item.textContent=name;item.title=name;list.append(item);}
   details.append(list);container.append(details);
  }
 }
}
setupManagedCaptions();
function note(id,text,missing){const el=$(id);if(!el)return;el.replaceChildren();const t=document.createElement('span');t.textContent=text;el.append(t);if(missing){const b=document.createElement('button');b.type='button';b.dataset.hubGo='1';b.textContent='Đến ô nạp dữ liệu';el.append(b);}}
function refresh(){
 const ready=[['before','Nhãn B'],['after','Nhãn A'],['images','Ảnh gốc'],['gold','Nhãn tham chiếu']];$('hubLoaded').replaceChildren();
 for(const [key,label] of ready){const qty=isLoaded(key),box=document.createElement('div');box.className='hubLoadedItem '+(qty?'hubReady':'hubMissing');const name=document.createElement('strong');name.textContent=label;const count=document.createElement('span');count.textContent=qty?`${qty} ${key==='images'?'ảnh':'tệp'}`:'Chưa nạp';box.append(name,count);$('hubLoaded').append(box);}
 $('hubExportBefore').disabled=!state.before.length;$('hubExportAfter').disabled=!state.after.length;
 const igSummary=window.YoloIntergroup?.getSummary?.();
 for(const [id,key] of [['hubClearSource','sourceTotal'],['hubClearIgBaseline','baselineTotal'],['hubClearIgImages','imageTotal'],['hubClearIgAssignment','assignmentTotal'],['hubClearIgReviews','reviewTotal']])$(id).disabled=!(igSummary?.[key]>0);
 for(const [id,qty] of [['hubClearBefore',state.before.length],['hubClearAfter',state.after.length],['hubClearGold',state.gold.length],['hubClearImages',getImages().length],['hubClearAfterImages',getAfterImages().length],['hubClearManifestData',state.manifest?.rows?.length||0],['hubClearEvalIdsData',state.evalIds?.rows?.length||0],['hubClearSchemaData',state.schema?.length||0]])$(id).disabled=!qty;
 updateManagedCaptions();
 const manifestSummary=$('hubManifestSummary');
 if(manifestSummary){
  const source=state.fileOrigins.manifest||'';
  const count=state.manifest?.rows?.length||0;
  const owners=count?new Set(state.manifest.rows.map(row=>String(row.assigned_reviewer_id||'').trim()).filter(Boolean)).size:0;
  manifestSummary.textContent=count?`Manifest đang dùng: ${source||'Không rõ nguồn'} · ${count.toLocaleString('vi-VN')} ảnh · ${owners} thành viên`: 'Manifest đang dùng: chưa nạp assignment_manifest.csv toàn nhóm';
  manifestSummary.dataset.ready=count&&owners>=2?'true':'false';
 }

 const ig=window.YoloIntergroup?.getSummary?.();if(ig&&$('igHubStatus'))$('igHubStatus').textContent=`Kiểm giữa nhóm (tách biệt): ${ig.ids.length} ID được giao · ${ig.images} ảnh · ${ig.base} baseline · ${ig.source} nhãn nhóm nguồn · ${ig.checked} ảnh đã kiểm.`;
 const b=!!state.before.length,a=!!state.after.length,img=!!getImages().length,gold=!!state.gold.length;
 note('hubNeedPrep',a?`Đã nạp ${state.after.length} tệp nhãn A. Xem QC bên dưới.`:'Thiếu nhãn A sau sửa. Hãy thả thư mục hoặc ZIP vào ô nạp dữ liệu ở mục 01.',!a);
 note('hubNeedEval',a&&gold?'Đã có nhãn A và Ground Truth. Có thể chấm sau khi QC.':`Cần bổ sung: ${[!a&&'nhãn A',!gold&&'Ground Truth'].filter(Boolean).join(', ')}.`,!a||!gold);
 note('hubNeedMatch',b&&a&&img?'Đã có nhãn B, A và ảnh gốc. Tất cả các mục dùng cùng dữ liệu.':`Cần bổ sung: ${[!b&&'nhãn B',!a&&'nhãn A',!img&&'ảnh gốc'].filter(Boolean).join(', ')}.`,!b||!a||!img);
 note('hubNeedCoords',img?`Đã có ${getImages().length} ảnh. Nhập image_id để mở; không cần chọn thư mục ở mục 05.`:'Chưa có ảnh gốc. Nạp ở mục 01 rồi nhập image_id tại mục 05.',!img);
}
document.addEventListener('click',e=>{if(!e.target.closest('[data-hub-go]'))return;hub.scrollIntoView({behavior:'smooth',block:'start'});$('hubDrop').focus?.({preventScroll:true});});
window.addEventListener('yolo:images-updated',()=>{refresh();scheduleQC();});
window.addEventListener('yolo:labels-updated',()=>{refresh();scheduleQC();});
window.addEventListener('yolo:intergroup-updated',refresh);
for(const id of ['manifestFile','schemaFile','classesFile','evalIdsFile','vm_import'])$(id)?.addEventListener('change',()=>setTimeout(refresh,180));

// Recursively read directory drops. readEntries() may yield partial chunks, so loop until empty.
async function filesFromDrop(dataTransfer){const out=[],items=[...(dataTransfer?.items||[])];
 if(items.some(item=>typeof item.webkitGetAsEntry==='function'&&item.webkitGetAsEntry()?.isDirectory)){
  const walk=async(entry,dir)=>{if(entry.isFile){const f=await new Promise((resolve,reject)=>entry.file(resolve,reject));f._hubPath=dir+f.name;out.push(f);return;}
   const reader=entry.createReader();while(true){const part=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!part.length)break;for(const child of part)await walk(child,dir+entry.name+'/');}};
  for(const item of items){const entry=item.webkitGetAsEntry?.();if(entry)await walk(entry,'');}
  return out;
 }
 return [...(dataTransfer?.files||[])];
}
const base=path=>path.split(/[\\/]/).pop();
const imageExt=/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i;
const ignoredTxt=/^(?:readme.*|license.*|classes|notes?|labels?_list|readme_export)\.txt$/i;
const roleNames=['before','after','member','gold','intergroupSource','skip'];
const knownBefore=/(?:^|[\W_])(?:before|original|originals|initial|baseline|raw|pre[-_ ]?edit|nhan[-_ ]?goc|nhan[-_ ]?ban[-_ ]?dau|labels?[-_]?b)(?:$|[\W_])/i;
const knownAfter=/(?:^|[\W_])(?:after|edited|corrected|revised|post[-_ ]?edit|nhan[-_ ]?sau|nhan[-_ ]?da[-_ ]?sua|labels?[-_]?a)(?:$|[\W_])/i;
const knownGold=/(?:^|[\W_])(?:gold|ground[-_ ]?truth|gt[-_]?labels?|reference[-_ ]?labels?|nhan[-_ ]?chuan)(?:$|[\W_])/i;
function suggestRole(group){const s=group.toLowerCase();return /(?:^|[^a-z0-9])g\d+[_-]?sv\d+(?=$|[^a-z0-9])/i.test(s)?'member':knownGold.test(s)?'gold':/(?:^|\/\s*)(?:G\d{2})$/i.test(group.trim())?'before':/(?:TRAFFIC_G\d{2}_REVIEW|\.yolov8\.zip|(?:^|\/)train\/labels)/i.test(s)?'after':s==='b'||knownBefore.test(s)?'before':s==='a'||knownAfter.test(s)?'after':'';}
function pathOf(file){return String(file._hubPath||file.webkitRelativePath||file.name).replace(/\\/g,'/');}
function partsOf(path){return path.split('/').filter(Boolean);}
function groupKey(path,nestedSplit=false){const parts=partsOf(path);if(parts.length===1)return 'Tệp TXT rời';if(parts.length>1){
 if(/\.zip$/i.test(parts[0])){
  const root=parts[0];const subs=parts.slice(1,-1);const found=subs.find(p=>suggestRole(p));return found?root+' / '+found:(nestedSplit&&subs[0]&&!/^(?:train|valid|test|labels|images|annotations|data)$/i.test(subs[0])?root+' / '+subs[0]:root);
 }
 if(nestedSplit&&parts.length>2&&!/^(?:train|valid|test|labels|images|annotations|data)$/i.test(parts[1]))return parts[0]+' / '+parts[1];
 const recognized=parts.slice(0,-1).find(p=>suggestRole(p));return recognized||parts[0];
 }
 return parts[0];}
function fileFromBytes(bytes,name,path){const f=new File([bytes],name,{type:imageExt.test(name)?'image/'+name.split('.').pop().toLowerCase():'application/octet-stream'});f._hubPath=path;return f;}
async function expandSources(raw){const out=[],failed=[],skippedJson=[],skippedExportImages=[];for(const file of raw){
 if(/\.json$/i.test(file.name)){skippedJson.push(pathOf(file));continue;}
 if(!/\.zip$/i.test(file.name)){out.push(file);continue;}
 if(file.size>1024*1024*1024){failed.push(`${file.name}: ZIP vượt 1 GB; hãy giải nén rồi dùng Chọn thư mục để tránh quá tải bộ nhớ trình duyệt.`);continue;}
 try{if(typeof JSZip==='undefined')throw Error('Thiếu thư viện đọc ZIP');const archive=await JSZip.loadAsync(await file.arrayBuffer());const roboflowExport=/TRAFFIC_G\d{2}_REVIEW.*\.yolov8\.zip$/i.test(file.name);let count=0;
  for(const entry of Object.values(archive.files)){if(entry.dir||/(?:^|\/)(?:__MACOSX|\.DS_Store)(?:\/|$)/i.test(entry.name)||/(?:^|\/)\._/.test(entry.name))continue;
   if(++count>20000)throw Error('ZIP có trên 20.000 tệp');const name=base(entry.name);if(/\.json$/i.test(name)){skippedJson.push(file.name+'/'+entry.name);continue;}if(roboflowExport&&imageExt.test(name)){skippedExportImages.push(file.name+'/'+entry.name);continue;}
   if(!/\.(?:txt|png|jpe?g|webp|bmp|gif|avif|csv|yaml|yml)$/i.test(name))continue;
   const bytes=await entry.async('uint8array');if(bytes.byteLength>200*1024*1024)throw Error('Tệp bên trong ZIP quá lớn');out.push(fileFromBytes(bytes,name,pathOf(file)+'/'+entry.name));
  }
 }catch(error){failed.push(`${file.name}: ${error.message}`);}}
 return {files:out,failed,skippedJson,skippedExportImages};}
function buildGroups(files){const labels=files.filter(f=>/\.txt$/i.test(f.name)&&!ignoredTxt.test(f.name));
 const roots=new Map();for(const f of labels){const p=partsOf(pathOf(f));const root=p[0]||'Tệp TXT rời';if(!roots.has(root))roots.set(root,new Set());if(p.length>2)roots.get(root).add(p[1]);}
 const splitRoots=new Set([...roots].filter(([root,sub])=>sub.size>1&&![...sub].every(n=>/^(?:train|valid|test|labels|images|annotations)$/i.test(n))).map(([root])=>root));
 const groups=new Map();for(const f of labels){const path=pathOf(f),key=groupKey(path,splitRoots.has(partsOf(path)[0]));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
 return groups;
}
function setInputFiles(id,files){const input=$(id);if(!input)throw Error('Không tìm thấy trình tiếp nhận '+id);const dt=new DataTransfer();for(const f of files)dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitForNative(){let waited=0;while(state.busy&&waited<20000){await pause(40);waited+=40;}await pause(90);}
function roleModal(groups){const modal=$('hubRoleOverlay'),rows=$('hubRoleRows'),error=$('hubRoleError');rows.replaceChildren();error.textContent='';
 const keys=[...groups.keys()];const inferred=keys.map(k=>{
  const records=groups.get(k);
  // A whole G11 ZIP may be grouped under its root, while member IDs live deeper in paths.
  // Offer member as a suggestion, but ALWAYS ask before importing.
  const containsReviewerPaths=records.some(f=>/(?:^|[^a-z0-9])g\d+[_-]?sv\d+(?=$|[^a-z0-9])/i.test(pathOf(f)));
  return containsReviewerPaths?'member':suggestRole(k);
 });
 // If B/A are both present, show both in one dialog, with suggested assignments visible.
 if(keys.length===2&&inferred.every(x=>!x)){
   if(!state.before.length&&!state.after.length){inferred[0]='before';inferred[1]='after';}
   else if(state.before.length&&!state.after.length)inferred[0]='after';
   else if(!state.before.length&&state.after.length)inferred[0]='before';
 }
 const selects=[];
 for(let i=0;i<keys.length;i++){const key=keys[i],list=groups.get(key),row=document.createElement('label');row.className='hubRoleRow';
  const info=document.createElement('span');info.innerHTML='';const n=document.createElement('strong');n.textContent=key;const count=document.createElement('small');count.textContent=`${list.length} tệp TXT · ví dụ ${list.slice(0,2).map(x=>x.name).join(', ')}`;info.append(n,count);
  const select=document.createElement('select');select.className='hubRoleSelect';select.setAttribute('aria-label','Vai trò của '+key);for(const role of roleNames.slice(0,3)){const option=document.createElement('option');option.value=role;option.textContent=hubRoleLabels[role];select.append(option);}
  const extra=document.createElement('optgroup');extra.label='Khác / nâng cao';
  for(const role of roleNames.slice(3)){const option=document.createElement('option');option.value=role;option.textContent=hubRoleLabels[role];extra.append(option);}
  select.append(extra);
  select.value=inferred[i]||'skip';select.dataset.group=key;row.append(info,select);rows.append(row);selects.push(select);
 }
 modal.hidden=false;document.body.classList.add('hubRoleOpen');selects[0]?.focus();
 return new Promise(resolve=>{
  const close=value=>{modal.hidden=true;document.body.classList.remove('hubRoleOpen');$('hubRoleApply').onclick=null;$('hubRoleCancel').onclick=null;document.removeEventListener('keydown',esc);resolve(value);};
  const esc=e=>{if(e.key==='Escape'){e.preventDefault();close(null);}};
  document.addEventListener('keydown',esc);
  $('hubRoleCancel').onclick=()=>close(null);
  $('hubRoleApply').onclick=()=>{const assignments=selects.map(el=>({key:el.dataset.group,role:el.value,files:groups.get(el.dataset.group)}));
   const roles=assignments.filter(g=>g.role!=='skip').map(g=>g.role);
   if(!roles.length){error.textContent='Hãy gán vai trò nhãn B, A, nhãn tham chiếu hoặc nhãn nhóm nguồn kiểm giữa nhóm.';return;}
   const duplicate=roles.find((r,i)=>r!=='member'&&roles.indexOf(r)!==i);if(duplicate){error.textContent=`Có hai thư mục đang cùng gán ${hubRoleLabels[duplicate]}. Hãy chọn đúng từng bộ hoặc bỏ qua thư mục không dùng.`;return;}
   if(roles.includes('member')){try{window.YoloMemberReady.manifestInfo();}catch(e){error.textContent='Nhãn thành viên cần assignment_manifest.csv hợp lệ. Nếu CSV nằm trong thư mục G11, hãy kiểm tra cột image_id, assigned_reviewer_id. '+e.message;return;}}
   close(assignments.filter(g=>g.role!=='skip'));
  };
 });
}
function isAssignmentManifestFilename(name){return /^assignment_manifest(?:\s*\(\d+\))?\.csv$/i.test(String(name||'').trim());}
function routeAllocationInput(kind,file){window.dispatchEvent(new CustomEvent('yolo:allocation-input',{detail:{kind,file}}));}
async function autoRouteMetadata(file,notices){const name=file.name.toLowerCase();
 try{
 if(/\.ya?ml$/i.test(name)){setInputFiles('classesFile',[file]);notices.push(`YAML: ${file.name}`);return;}
 if(/\.csv$/i.test(name)){
  const header=(await file.text()).replace(/^\ufeff/,'').split(/\r?\n/,1)[0].split(',').map(c=>c.trim().replace(/^"|"$/g,'').toLowerCase());
  const all=arr=>arr.every(c=>header.includes(c));
  // Reuse section-01 upload, without introducing an extra picker in section 07.
  if((all(['image_id','original_reviewer_id','checker_id','check_type'])&&!header.includes('result'))||/^(?:crosscheck[_-]?assignments)(?:\s*\(\d+\))?\.csv$/.test(name)){
   if(!window.YoloInternalCrosscheck?.ingestAssignments)throw Error('Bộ kiểm tra nội bộ chưa được nạp.');
   const message=await window.YoloInternalCrosscheck.ingestAssignments(file);
   routeAllocationInput('official',file);notices.push(`${message} · đã chuyển mẫu sang mục 07`);return;
  }
  if((all(['image_id','reviewer_id','reviewed_at'])&&!header.includes('checker_id'))||/^review_log(?:\s*\(\d+\))?\.csv$/.test(name)){
   routeAllocationInput('log',file);notices.push(`Nhật ký review: ${file.name} → mục 07`);
   // Continue original schema routing if it has the complete legacy log fields.
   if(!all(['image_id','reviewer_id','review_status','boxes_added','boxes_removed','boxes_modified','reviewed_at','notes','revision','class_changes','geometry_changes']))return;
  }
  let id=null;
  if(all(['image_id','reviewer_id','review_status','boxes_added','boxes_removed','boxes_modified','reviewed_at','notes','revision','class_changes','geometry_changes']))id='schemaFile';
  else if(isAssignmentManifestFilename(file.name)){
   if(!all(['image_id','assigned_reviewer_id']))throw Error('assignment_manifest.csv cần đủ hai cột image_id và assigned_reviewer_id.');
   id='manifestFile';
  }
  else if(/^g\d+_sv\d+.*\.csv$/i.test(name)&&header.includes('image_id')){
   notices.push(`CSV thành viên ${file.name}: không dùng thay assignment_manifest.csv; giữ nguyên phân công toàn nhóm`);
   return;
  }
  else if(header.includes('image_id')&&(header.length<=2||/eval|ids|danh_sach/i.test(name)))id='evalIdsFile';
  if(id==='manifestFile'){
   const previousManifest=state.manifest;
   setInputFiles(id,[file]);await waitForNative();
   if(!state.manifest||state.manifest===previousManifest)throw Error(`${file.name} không đạt kiểm tra; manifest đã nạp trước đó vẫn được giữ nguyên.`);
   notices.push(`Manifest: ${file.name} (${state.manifest.rows.length} ảnh)`);
  }else if(id){setInputFiles(id,[file]);notices.push(`CSV: ${file.name}`);}
  else notices.push(`CSV ${file.name}: chưa xác định được mục đích, đã bỏ qua để tránh nhập nhầm`);
  return;
 }
 }catch(error){
  // Never describe a previous valid manifest as if the new invalid file was accepted.
  if(isAssignmentManifestFilename(file.name))throw error;
  notices.push(`Không đọc được ${file.name}: ${error.message}`);
 }
}
// Serialize uploads instead of rejecting a second batch while a B/A confirmation dialog is open.
// Each completed/cancelled/error batch releases the slot and the next one is processed.
let loading=false;
const uploadQueue=[];
const inFlightBatches=new Set();
function batchFingerprint(files){return files.map(f=>`${pathOf(f)}:${f.size}:${f.lastModified}`).sort().join('\n');}
function ingest(raw,options={}){
 const incoming=Array.from(raw||[]);
 const sessionFiles=incoming.filter(file=>/\.json$/i.test(file.name)&&/^chia_viec_phien_/i.test(file.name));
 for(const file of sessionFiles)routeAllocationInput('session',file);
 const skippedJson=incoming.filter(file=>/\.json$/i.test(file.name)&&!sessionFiles.includes(file)).length;
 const files=incoming.filter(file=>!/\.json$/i.test(file.name));
 if(!files.length){
  if(sessionFiles.length)status(`Đã chuyển ${sessionFiles.length} phiên Chia việc JSON sang mục 07.`,false);
  else if(skippedJson)status(`Đã bỏ qua ${skippedJson} tệp JSON. JSON không được nạp vào dữ liệu chung.`,false);
  return Promise.resolve();
 }
 const key=batchFingerprint(files);
 if(inFlightBatches.has(key)){
  status('Bộ dữ liệu này đã được nhận và đang xử lý. Hãy xác nhận hoặc hủy trong cửa sổ đang mở; không cần chọn lại.',false);
  return Promise.resolve();
 }
 inFlightBatches.add(key);
 return new Promise(resolve=>{
  uploadQueue.push({files,key,resolve,skippedJson,folderMode:!!options.folderMode});
  if(loading){status(`Đã nhận thêm ${files.length} tệp vào hàng đợi. Hoàn tất xác nhận nhãn đang mở; chương trình sẽ tự xử lý lượt tiếp theo.`,false);}
  else void processUploadQueue();
 });
}
async function processUploadQueue(){
 if(loading)return;
 loading=true;
 try{
  while(uploadQueue.length){
   const task=uploadQueue.shift();
   try{await processUploadBatch(task.files,task.skippedJson,task.folderMode);}
   catch(error){status('Lỗi nạp dữ liệu: '+error.message,true);}
   finally{inFlightBatches.delete(task.key);task.resolve();}
  }
 }finally{loading=false;}
}
async function processUploadBatch(raw,initialSkippedJson=0,folderMode=false){
 // Unified member-label routing is only attempted for recognizable member folders/ZIPs.
  const failures=[],messages=[];status(`Đang phân loại ${raw.length} tệp/thư mục…`);
 try{
  const expanded=await expandSources(raw);failures.push(...expanded.failed);const files=expanded.files;
  const skippedJson=initialSkippedJson+expanded.skippedJson.length;const skippedExportImages=expanded.skippedExportImages?.length||0;
  // Read a nested assignment_manifest.csv BEFORE the role picker and member-label validation.
  // This allows one upload of G11/ (manifest + labels of all reviewers) without a separate step.
  const allManifests=files.filter(f=>isAssignmentManifestFilename(f.name));
  if(allManifests.length>1)throw Error(`Có ${allManifests.length} tệp assignment_manifest.csv trong một lượt nạp. Hãy giữ một bản chuẩn để tránh phân công xung đột.`);
  if(allManifests.length){
   status('Đang đọc assignment_manifest.csv trong thư mục/ZIP trước khi phân loại nhãn…');
   const previousManifest=state.manifest;
   setInputFiles('manifestFile',[allManifests[0]]);await waitForNative();
   if(!state.manifest||state.manifest===previousManifest)throw Error('assignment_manifest.csv có trong thư mục nhưng không đọc được. Kiểm tra cột image_id và assigned_reviewer_id, hoặc định dạng CSV; manifest cũ được giữ nguyên.');
   messages.push(`Phân công: ${state.manifest.rows.length} ảnh`);
  }
  const inter=window.YoloIntergroup?.classify(files)||{main:files,data:null};const mainFiles=inter.main;const groups=buildGroups(mainFiles),images=mainFiles.filter(f=>imageExt.test(f.name)&&!/\/\._/.test(pathOf(f))),other=mainFiles.filter(f=>/\.(?:csv|yaml|yml)$/i.test(f.name));
  let assignments=[];
  if(groups.size){
   status(`Đã tìm thấy ${groups.size} nhóm nhãn TXT. Chọn vai trò: B, A hoặc Nhãn thành viên trong cửa sổ xác nhận.`,false);
   assignments=await roleModal(groups);
   if(assignments===null){status('Đã hủy lượt chọn nhãn. Dữ liệu trước đó vẫn giữ nguyên.');return;}
  }
  // A source Roboflow export used for intergroup must NOT put its images/YAML into main.
  const intergroupSourceZipRoots=new Set(assignments.filter(a=>a.role==='intergroupSource').flatMap(a=>a.files.map(f=>partsOf(pathOf(f))[0])).filter(r=>/\.zip$/i.test(r)));
  const isSourceZipFile=f=>intergroupSourceZipRoots.has(partsOf(pathOf(f))[0]);
  // Store member labels in an isolated repository; never overwrite A without QC confirmation.
  const memberGroups=assignments.filter(a=>a.role==='member');
  if(memberGroups.length){
   const memberResult=await window.YoloMerge.ingestExpandedGroups(memberGroups);
   if(!memberResult.ok)throw Error(memberResult.message);
   messages.push(memberResult.message);
  }
  // Only after confirmation: apply the staged B/A batch. Keep B, A and GT independent.
  for(const a of assignments){if(a.role==='member')continue;if(a.role==='intergroupSource'){messages.push(await window.YoloIntergroup.ingestSource(a.files));continue;}setInputFiles(a.role==='before'?'beforeFiles':a.role==='after'?'afterFiles':'goldFiles',a.files);await waitForNative();messages.push(`${a.key} → ${hubRoleLabels[a.role]} (${a.files.length} TXT)`);}
  if(inter.data&&(inter.data.assign.length||inter.data.image.length||inter.data.baseline.length||inter.data.source.length)){messages.push(await window.YoloIntergroup.ingest(inter.data));}
  const mainImages=images.filter(f=>!isSourceZipFile(f));
  if(mainImages.length){const afterImages=mainImages.filter(f=>/(?:^|\/)(?:after[_-]?images|images[_-]?after|anh[_-]?sau)\//i.test(pathOf(f)));
   const originals=mainImages.filter(f=>!afterImages.includes(f));
   if(originals.length){const ok=await window.MatchReview.addImages(originals);if(ok)messages.push(`${originals.length} ảnh gốc`);else failures.push('Không nạp được một số ảnh gốc; xem thông báo mục 04.');}
   if(afterImages.length){const ok=await window.MatchReview.addAfterImages(afterImages);if(ok)messages.push(`${afterImages.length} ảnh sau riêng`);else failures.push('Không nạp được ảnh sau riêng.');}
  }
  for(const f of other.filter(f=>!isSourceZipFile(f)&&!allManifests.includes(f))){await autoRouteMetadata(f,messages);await waitForNative();}
  refresh();window.YoloAfterQC?.scan?.();
  if(skippedExportImages)messages.push(`Bỏ qua ${skippedExportImages} ảnh export Roboflow để bảo toàn ảnh gốc từ Gxx`);const summary=messages.length?`Đã nhận: ${messages.join(' · ')}.`:'Chưa nhận diện được tệp có thể sử dụng.';
  status(summary+(skippedJson?` Đã bỏ qua ${skippedJson} tệp JSON.`:'')+(failures.length?' Lỗi: '+failures.join('; '):''),!!failures.length);
 }catch(error){status('Không thể xử lý dữ liệu: '+error.message,true);}
}
// Clear the native file input immediately; the same file/folder can be selected again
// after cancellation, even if the batch is still awaiting role confirmation.
for(const inputId of ['hubAnyFiles','hubAnyFolder']){
 $(inputId).onchange=e=>{const selected=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';void ingest(selected,{folderMode:inputId==='hubAnyFolder'});};
}
const drop=$('hubDrop');drop.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();drop.classList.add('hubOver');});
drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('hubOver');});
drop.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();drop.classList.remove('hubOver');
 try{const incoming=await filesFromDrop(e.dataTransfer);if(incoming.length)await ingest(incoming);else status('Không đọc được thư mục từ thao tác kéo thả; hãy dùng “Chọn thư mục” trong cùng ô.',true);}catch(error){status('Lỗi đọc dữ liệu kéo thả: '+error.message,true);}
});
window.YoloAutoUpload={ingest,groupFiles:buildGroups,listLoaded:()=>({before:state.before.length,after:state.after.length,images:getImages().length,gold:state.gold.length})};
// QC kỹ thuật nhãn A: các quy tắc độc lập, kiểm tra phạm vi theo image_id và pixel gốc.
const floatPattern=/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const typeNames=['2-wheel vehicles','bus','car','truck'];
const qcRules=[
 {title:'Định dạng YOLO',subtitle:'5 cột, số hữu hạn và class 0–3',codes:['COLUMN_COUNT','CLASS_ID','INVALID_NUMBER','NONFINITE','NONPOSITIVE_SIZE','BAD_IMAGE_ID','DUPLICATE_IMAGE_ID']},
 {title:'Tọa độ & biên ảnh',subtitle:'Tâm, kích thước và cạnh box [0, 1]',codes:['CENTER_OUTSIDE','OUT_OF_BOUNDS','CLAMP_TINY']},
 {title:'Box trùng hoặc gần trùng',subtitle:'Trùng hoàn toàn · gần trùng IoU ≥ 0,995',codes:['DUPLICATE_EXACT','NEAR_DUPLICATE']},
 {title:'Kích thước theo pixel gốc',subtitle:'Cao < 12 px · rộng < 1 px',codes:['HEIGHT_LT_12PX','WIDTH_LT_1PX','IMAGE_DECODE'],kind:'pixel'},
 {title:'Độ đầy đủ ảnh và nhãn',subtitle:'Khớp image_id với manifest và ảnh đã nạp',codes:['MANIFEST_ID_INVALID','MANIFEST_ID_DUPLICATE','MISSING_LABEL','EXTRA_LABEL','IMAGE_MISSING'],kind:'coverage'}
];
let issues=[],scanSeq=0,scanning=false,unknownImageCount=0;
let qcRevision=0,lastCompleteRevision=-1;
let qcMetrics={boxes:0,validBoxes:0,pixelScanned:0,matchedImages:0,coverage:null};
const dimensionCache=new WeakMap();
function issue(severity,key,line,clazz,code,description){issues.push({severity,image_id:key,after_line:line,class_name:clazz,check_code:code,message:description});}
function canonicalManifestId(value){
 const raw=scopeId(String(value||'').trim());return raw?cleanId(raw+'.txt',$('normalize').checked):'';
}
// Scope selection is only used for required IDs. Unrelated labels are compared to the FULL manifest.
function getCoverage(){
 const rows=state.manifest?.rows;
 if(!rows)return null;
 const ids=[],allIds=new Set(),dup=[],invalid=[];
 const reviewer=state.manifestScope==='member'?state.selectedMember:'';
 for(const [i,row] of rows.entries()){
  const id=canonicalManifestId(row.image_id);
  if(!id||id==='.'||id==='..'){invalid.push(i+2);continue;}
  if(allIds.has(id))dup.push(id);
  allIds.add(id);
  if(!reviewer||(row.assigned_reviewer_id||'').trim()===reviewer)ids.push(id);
 }
 const expected=[...new Set(ids)];
 return {expected,allIds,dup,invalid,reviewer,matched:0,missing:0,extra:0,withoutImage:0};
}
function inspectLabels(files,coverage){
 const findings=[];
 const issue=(severity,image_id,after_line,class_name,check_code,message)=>findings.push({severity,image_id,after_line,class_name,check_code,message});
 const images=new Set(getImages()),seenNames=new Map();
 let unknownImages=0;
 const metrics={boxes:0,validBoxes:0,pixelScanned:0,matchedImages:0,coverage};
 for(const file of files){
  const id=cleanId(file.name,$('normalize').checked);
  if(seenNames.has(id))issue('ERROR',id,0,'','DUPLICATE_IMAGE_ID',`Trùng ID chuẩn hóa giữa ${seenNames.get(id)} và ${file.name}.`);
  else seenNames.set(id,file.name);
  if(!id||id==='.'||id==='..')issue('ERROR',id,0,'','BAD_IMAGE_ID','ID ảnh rỗng/không hợp lệ.');
  const seenExact=new Map(),boxes=[],lines=file.text.replace(/^\uFEFF/,'').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const raw=lines[i].trim();if(!raw)continue;
   metrics.boxes++;
   const p=raw.split(/\s+/),line=i+1;
   if(p.length!==5){issue('ERROR',id,line,'','COLUMN_COUNT',`Cần đúng 5 cột class x_center y_center width height; hiện có ${p.length}.`);continue;}
   const cls=Number(p[0]),name=/^[0-3]$/.test(p[0])?typeNames[cls]:'';
   if(!/^[0-3]$/.test(p[0])){issue('ERROR',id,line,'','CLASS_ID','class_id phải là số nguyên 0, 1, 2 hoặc 3.');continue;}
   if(p.slice(1).some(n=>!floatPattern.test(n))){issue('ERROR',id,line,name,'INVALID_NUMBER','Tọa độ không phải số YOLO hợp lệ (không nhận NaN, Infinity, dấu phẩy hoặc ký tự lạ).');continue;}
   const g=p.slice(1).map(Number);if(g.some(n=>!Number.isFinite(n))){issue('ERROR',id,line,name,'NONFINITE','Tọa độ vượt miền số hữu hạn.');continue;}
   const [x,y,w,h]=g;
   if(w<=0||h<=0){issue('ERROR',id,line,name,'NONPOSITIVE_SIZE','Chiều rộng và chiều cao phải lớn hơn 0.');continue;}
   metrics.validBoxes++;
   if(x<0||x>1||y<0||y>1)issue('ERROR',id,line,name,'CENTER_OUTSIDE','Tâm box nằm ngoài miền [0,1].');
   const left=x-w/2,top=y-h/2,right=x+w/2,bottom=y+h/2;
   const exceed=Math.max(0,-left,-top,right-1,bottom-1);
   if(exceed>1e-5+1e-12)issue('ERROR',id,line,name,'OUT_OF_BOUNDS',`Box vượt cạnh ảnh ${exceed.toPrecision(4)} (tọa độ chuẩn hóa). Phải sửa, không tự cắt biên lớn.`);
   else if(exceed>1e-12)issue('WARNING',id,line,name,'CLAMP_TINY',`Box vượt biên nhỏ ${exceed.toExponential(2)}; chỉ cắt khi bật tùy chọn.`);
   const exact=[cls,...g].join('|');
   if(seenExact.has(exact))issue('ERROR',id,line,name,'DUPLICATE_EXACT',`Trùng hoàn toàn với box A dòng ${seenExact.get(exact)}.`);
   else seenExact.set(exact,line);
   boxes.push({line,cls,g,w,h,left,top,right,bottom});
  }
  if(!boxes.length&&!lines.some(v=>v.trim()))issue('INFO',id,0,'','EMPTY_LABEL','TXT trống. Xác nhận ảnh thực sự không có phương tiện.');
  // Sweep line: only compare boxes whose horizontal ranges overlap.
  // A near-duplicate (IoU >= .995) must have near-equal areas.
  const sorted=boxes.slice().sort((a,b)=>a.left-b.left||a.line-b.line),activeBoxes=[];
  for(const a of sorted){
   for(let k=activeBoxes.length-1;k>=0;k--)if(activeBoxes[k].right<a.left)activeBoxes.splice(k,1);
   for(const b of activeBoxes){
    if(a.cls!==b.cls||a.top>=b.bottom||b.top>=a.bottom)continue;
    const ar=a.w*a.h,br=b.w*b.h;
    if(Math.min(ar,br)/Math.max(ar,br)<.995)continue;
    const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    const iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    const overlap=ix*iy,union=ar+br-overlap;
    if(overlap>0&&union>0&&overlap/union>=.995&&[a.cls,...a.g].join('|')!==[b.cls,...b.g].join('|')){
     const later=a.line>b.line?a:b,earlier=a.line>b.line?b:a;
     issue('WARNING',id,later.line,typeNames[a.cls],'NEAR_DUPLICATE',`Gần trùng với box A dòng ${earlier.line} (IoU ${(overlap/union).toFixed(4)}). Xem lại trên ảnh.`);
    }
   }
   activeBoxes.push(a);
  }
  if(images.has(id))metrics.matchedImages++;
  else unknownImages++;
 }
 if(coverage){
  for(const line of coverage.invalid)issue('ERROR','',line,'','MANIFEST_ID_INVALID',`Manifest dòng ${line} có image_id rỗng hoặc không hợp lệ.`);
  for(const id of new Set(coverage.dup))issue('ERROR',id,0,'','MANIFEST_ID_DUPLICATE','Trùng image_id trong assignment_manifest.csv sau chuẩn hóa.');
  for(const id of coverage.expected){
   if(seenNames.has(id))coverage.matched++;
   else{coverage.missing++;issue('ERROR',id,0,'','MISSING_LABEL','Thiếu TXT nhãn A của ảnh được giao theo manifest. Không coi là ảnh 0 box.');}
   if(images.size&&!images.has(id)){coverage.withoutImage++;issue('WARNING',id,0,'','IMAGE_MISSING','Thiếu ảnh gốc của image_id trong manifest: chưa thể xem ảnh/kiểm pixel.');}
  }
  for(const id of seenNames.keys())if(!coverage.allIds.has(id)){
   coverage.extra++;issue('ERROR',id,0,'','EXTRA_LABEL','TXT nhãn A có image_id không nằm trong assignment_manifest.csv.');
  }
 }else if(images.size){
  for(const id of seenNames.keys())if(!images.has(id))
   issue('WARNING',id,0,'','IMAGE_MISSING','Nhãn A chưa có ảnh gốc cùng image_id; không thể kiểm kích thước pixel.');
 }
 return {findings,metrics,unknownImages};
}

function evaluateSync(){
 const result=inspectLabels(state.after,getCoverage());
 issues=result.findings;qcMetrics=result.metrics;unknownImageCount=result.unknownImages;
 return issues;
}
function assertValid(){
 // Pixel findings are asynchronous; evaluateSync resets issues. Preserve current pixel ERRORs
 // before structural validation so a height-under-12px ERROR also blocks export.
 if(scanning||(getImages().length>0&&lastCompleteRevision!==qcRevision))throw Error('QC pixel đang chạy hoặc dữ liệu đã thay đổi. Hoàn tất Kiểm tra lại ở mục 02 trước khi xuất.');
 const pixelFindings=lastCompleteRevision===qcRevision?issues.filter(x=>x.check_code==='HEIGHT_LT_12PX'||x.check_code==='WIDTH_LT_1PX'||x.check_code==='IMAGE_DECODE'):[];
 const pixelScanned=qcMetrics.pixelScanned;
 const data=evaluateSync();
 // Keep already-verified pixel findings visible after export validation.
 issues.push(...pixelFindings);qcMetrics.pixelScanned=pixelScanned;
 const errors=issues.filter(x=>x.severity==='ERROR');
 if(errors.length)throw Error(`QC nhãn A: ${errors.length} lỗi. ${errors[0].image_id||'manifest'} · ${errors[0].after_line?'dòng '+errors[0].after_line+': ':''}${errors[0].message} Xem mục 02 để sửa.`);
}
function assertCoverage(){
 // Called when preparing ZIP; prevents a silently incomplete set against the chosen manifest scope.
 const c=getCoverage();if(!c)return;
 const available=new Set(state.after.map(f=>cleanId(f.name,$('normalize').checked)));
 const missing=c.expected.filter(id=>!available.has(id));
 const extra=[...available].filter(id=>!c.allIds.has(id));
 if(c.invalid.length||c.dup.length||missing.length||extra.length)
  throw Error(`Bộ nhãn chưa khớp manifest: thiếu ${missing.length} TXT, thừa ${extra.length} TXT ngoài danh sách, ${c.dup.length} ID trùng, ${c.invalid.length} ID không hợp lệ. Xem mục 02 để biết image_id cụ thể.`);
}
function imageDimensions(file){
 if(dimensionCache.has(file))return dimensionCache.get(file);
 const promise=(async()=>{
  if(typeof createImageBitmap==='function'){const bitmap=await createImageBitmap(file);const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;}
  return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight});};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Không đọc được kích thước ảnh.'));};img.src=url;});
 })();dimensionCache.set(file,promise);return promise;
}
// Recheck must provide visible feedback, including when findings do not change.
// Every scan has an ID: an older async image read can never overwrite a newer run.
const qcRecheckButton=$('qcLabels');
let activeManualScan=0;
function qcRunNotice(message,kind='done'){
 const el=$('qcRunFeedback');if(!el)return;
 el.hidden=false;el.textContent=message;el.dataset.kind=kind;
}
function inspectPixelBoxes(file,key,dimensions,report){
 const {height,width}=dimensions;
 for(const [idx,raw] of file.text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const p=raw.trim().split(/\s+/);if(p.length!==5||!/^[0-3]$/.test(p[0])||p.slice(1).some(v=>!floatPattern.test(v)))continue;
  const g=p.slice(1).map(Number);if(g.some(v=>!Number.isFinite(v))||g[2]<=0||g[3]<=0)continue;
  if(g[3]*height<12-1e-8)report('ERROR',key,idx+1,typeNames[Number(p[0])],'HEIGHT_LT_12PX',`Cao ${+(g[3]*height).toFixed(2)} px (< 12 px trên ảnh ${width} × ${height}). Xem ảnh và xác nhận xử lý tại mục 02.`);
  if(g[2]*width<1-1e-8)report('WARNING',key,idx+1,typeNames[Number(p[0])],'WIDTH_LT_1PX',`Rộng ${(g[2]*width).toFixed(2)} px (< 1 px). Cần xem lại.`);
 }
}
async function assertScope(keys,files){
 const {findings}=inspectLabels(files,null);
 const errors=findings.filter(item=>item.severity==='ERROR');
 if(errors.length)throw Error(`QC nhãn A trong phạm vi: ${errors[0].image_id} · ${errors[0].message} Xem mục 02 để sửa.`);
 const available=new Set(files.map(file=>cleanId(file.name,$('normalize').checked)));
 for(const key of keys)if(!available.has(key))throw Error(`Thiếu TXT nhãn A trong phạm vi: ${key}. Xem mục 02 để sửa.`);
 for(const file of files){
  const key=cleanId(file.name,$('normalize').checked),image=window.MatchReview?.getImageFile?.(key);
  if(!image)continue;
  let dimensions;
  try{dimensions=await imageDimensions(image);}catch{continue;} // Same warning-only rule as the full QC scan.
  inspectPixelBoxes(file,key,dimensions,(severity,id,line,name,code,message)=>{
   if(severity==='ERROR')throw Error(`QC nhãn A trong phạm vi: ${id} · dòng ${line} · ${message}`);
  });
 }
}
async function scanQC(options={}){
 const manual=options?.manual===true;
 const seq=++scanSeq,revision=qcRevision;
 if(manual){
  activeManualScan=seq;
  qcRecheckButton.disabled=true;
  qcRecheckButton.textContent='Đang kiểm tra…';
  qcRecheckButton.setAttribute('aria-busy','true');
  qcRunNotice(`Đang kiểm tra ${state.after.length} tệp nhãn A…`,'running');
 }
 try{
  if(!state.after.length){
   issues=[];scanning=false;lastCompleteRevision=revision;
   qcMetrics={boxes:0,validBoxes:0,pixelScanned:0,matchedImages:0,coverage:getCoverage()};
   unknownImageCount=0;display();
   if(manual)qcRunNotice('Chưa có nhãn A. Nạp nhãn ở mục 01 trước khi kiểm tra.','warning');
   return true;
  }
  scanning=true;
  // Yield once for a manual run so the browser paints the busy state before QC begins.
  if(manual)await new Promise(resolve=>requestAnimationFrame(resolve));
  if(seq!==scanSeq)return false;
  evaluateSync();
  const qcStatus=$('afterQcStatus');
  qcStatus.textContent='Đang kiểm tra kích thước pixel trên ảnh gốc…';qcStatus.className='qcStatus is-pending';
  const maps=state.after.map(file=>({key:cleanId(file.name,$('normalize').checked),file})).filter(x=>window.MatchReview?.getImageFile?.(x.key));
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,maps.length)},async()=>{
   while(cursor<maps.length){const {key,file}=maps[cursor++];try{
    const dimensions=await imageDimensions(window.MatchReview.getImageFile(key));if(seq!==scanSeq)return;
    qcMetrics.pixelScanned++;
    inspectPixelBoxes(file,key,dimensions,issue);
   }catch(e){if(seq===scanSeq)issue('WARNING',key,0,'','IMAGE_DECODE',`Không đọc được ảnh để kiểm tra pixel: ${e.message}`);}
  }}));
  if(seq!==scanSeq)return false;
  scanning=false;lastCompleteRevision=revision;display();
  if(manual){
   const errors=issues.filter(e=>e.severity==='ERROR').length;
   const warnings=issues.filter(e=>e.severity==='WARNING').length;
   const now=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
   const pixels=maps.length?` · ${qcMetrics.pixelScanned}/${maps.length} ảnh kiểm pixel`:' · chưa có ảnh khớp để kiểm pixel';
   qcRunNotice(`Đã kiểm tra lại ${now} · ${state.after.length} TXT / ${qcMetrics.boxes} box · ${errors} lỗi, ${warnings} cảnh báo${pixels}.`,errors?'warning':'done');
  }
  return true;
 }catch(e){
  if(seq===scanSeq){
   scanning=false;lastCompleteRevision=-1;
   $('afterQcStatus').textContent='QC không hoàn tất: '+(e?.message||String(e));
   $('afterQcStatus').className='qcStatus is-bad';
   qcRunNotice('Kiểm tra thất bại: '+(e?.message||String(e)),'error');
   refreshQuickActions();
  }
  return false;
 }finally{
  if(manual&&activeManualScan===seq){
   activeManualScan=0;qcRecheckButton.disabled=false;
   qcRecheckButton.textContent='Kiểm tra lại';
   qcRecheckButton.removeAttribute('aria-busy');
   if(seq!==scanSeq)qcRunNotice('Dữ liệu vừa thay đổi; QC tự động chạy lại theo dữ liệu mới.','warning');
  }
 }
}
const qcRuleStatuses={ERROR:'Lỗi',WARNING:'Cảnh báo',INFO:'Thông tin'};
const severityTitle={ERROR:'Lỗi',WARNING:'Cảnh báo',INFO:'Thông tin'};
function pill(value,variant){const el=document.createElement('span');el.className='qcRulePill '+variant;el.textContent=value;return el;}
function renderOverview(){
 const cards=[
  ['Nhãn A',state.after.length,'tệp TXT đã nạp','neutral'],
  ['Box được đọc',qcMetrics.boxes,`${qcMetrics.validBoxes} box hợp lệ về cấu trúc`,'neutral'],
  ['Lỗi cần sửa',issues.filter(i=>i.severity==='ERROR').length,'cản trở xuất gói','bad'],
  ['Cảnh báo',issues.filter(i=>i.severity==='WARNING').length,'cần kiểm tra bằng mắt','warn']
 ];
 const el=$('qcOverview');el.replaceChildren();
 for(const [name,num,note,kind] of cards){const card=document.createElement('div');card.className='qcStat qcStat-'+kind;const title=document.createElement('span');title.textContent=name;const value=document.createElement('strong');value.textContent=String(num);const detail=document.createElement('small');detail.textContent=note;card.append(title,value,detail);el.append(card);}
}
function renderCoverage(){
 const el=$('qcCoverage'),c=qcMetrics.coverage;el.replaceChildren();el.className='qcCoverage';
 const title=document.createElement('strong'),text=document.createElement('p');
 if(!c){title.textContent='Độ đầy đủ · Chưa thể xác nhận';text.textContent='Chưa có assignment_manifest.csv. QC chỉ kiểm các nhãn A đã nạp; không thể kết luận đủ số ảnh được giao. Nạp manifest ở mục 01 để đối chiếu từng image_id.';el.classList.add('is-pending');}
 else{
  const scope=c.reviewer?` của ${c.reviewer}`:' trong manifest';
  title.textContent=`Độ đầy đủ · ${c.matched}/${c.expected.length} nhãn A khớp ID${scope}`;
  text.textContent=`Thiếu ${c.missing} TXT · ${c.extra} TXT ngoài manifest · ${c.dup.length} ID trùng · ${c.invalid.length} ID không hợp lệ.`+(getImages().length?` Ảnh gốc thiếu: ${c.withoutImage}.`:' Chưa nạp ảnh gốc nên chưa xác nhận độ đầy đủ ảnh.');
  el.classList.add(c.missing||c.extra||c.dup.length||c.invalid.length?'is-bad':!getImages().length||c.withoutImage?'is-pending':'is-good');
 }
 el.append(title,text);
}
function renderRules(){
 const holder=$('qcRules');holder.replaceChildren();
 for(const rule of qcRules){
  const relevant=issues.filter(x=>rule.codes.includes(x.check_code));
  const errors=relevant.filter(x=>x.severity==='ERROR').length,warnings=relevant.filter(x=>x.severity==='WARNING').length;
  let text='',cls='is-good';
  if(!state.after.length){text='Chờ nhãn A';cls='is-pending';}
  else if(rule.kind==='pixel'&&!getImages().length){text='Chưa kiểm · thiếu ảnh gốc';cls='is-pending';}
  else if(rule.kind==='pixel'&&scanning){text='Đang kiểm tra ảnh…';cls='is-pending';}
  else if(rule.kind==='pixel'&&unknownImageCount){text=`Đã kiểm ${qcMetrics.pixelScanned}/${state.after.length} ảnh; ${unknownImageCount} chưa khớp ảnh`;cls='is-pending';}
  else if(rule.kind==='coverage'&&!qcMetrics.coverage){text='Chưa xác nhận · thiếu manifest';cls='is-pending';}
  else if(rule.kind==='coverage'&&!getImages().length){text='Đã so nhãn với manifest; chưa có ảnh gốc';cls='is-pending';}
  else if(rule.kind==='coverage'&&qcMetrics.coverage?.withoutImage){text=`Thiếu ${qcMetrics.coverage.withoutImage} ảnh gốc`;cls='is-pending';}
  else text='Đã kiểm tra';
  if(errors){text=`${errors} lỗi`+(warnings?` · ${warnings} cảnh báo`:'');cls='is-bad';}
  else if(warnings){text=`${warnings} cảnh báo`+(cls==='is-pending'?' · chưa đầy đủ':'');cls='is-warn';}
  const line=document.createElement('div');line.className='qcRule';
  const copy=document.createElement('div'),name=document.createElement('strong'),sub=document.createElement('span');
  name.textContent=rule.title;sub.textContent=rule.subtitle;copy.append(name,sub);
  line.append(copy,pill(text,cls));holder.append(line);
 }
}
// Chọn thao tác theo mức độ tin cậy. Không tự làm thay phán đoán xe thật.
const qcStructuralCodes=new Set(['COLUMN_COUNT','CLASS_ID','INVALID_NUMBER','NONFINITE','NONPOSITIVE_SIZE']);
const qcBoxCodes=new Set(['CENTER_OUTSIDE','OUT_OF_BOUNDS','CLAMP_TINY','DUPLICATE_EXACT','NEAR_DUPLICATE','HEIGHT_LT_12PX','WIDTH_LT_1PX']);
const qcLineCodes=new Set([...qcStructuralCodes,...qcBoxCodes]);
const qcPreviewCodes=new Set(['HEIGHT_LT_12PX']);
function originalLine(info){
 let file;try{file=nameMap(state.after).get(info.image_id);}catch{return null;}
 return file?.text.replace(/^\uFEFF/,'').split(/\r?\n/)[info.after_line-1]?.trim()??null;
}
function qcFeedback(text,error=false){
 const el=document.getElementById('qcActionFeedback');el.hidden=false;
 const t=document.getElementById('qcActionFeedbackText');t.textContent=text;t.style.color=error?'var(--qc-bad,#b63a34)':'';
}
function requireUnchanged(info,expected){
 if(!state.after.length)throw Error('Nhãn A không còn trong phiên.');
 const file=nameMap(state.after).get(info.image_id);
 if(!file)throw Error('Không tìm thấy nhãn A: '+info.image_id);
 const rows=file.text.replace(/^\uFEFF/,'').split(/\r?\n/);
 if(rows[info.after_line-1]?.trim()!==expected)throw Error('Dòng TXT đã thay đổi. Kiểm tra QC lại trước khi thao tác.');
 return {file,rows};
}
function commitQCLine(info,expected,replacement,verb){
 const {file,rows}=requireUnchanged(info,expected);
 if(replacement===null)rows.splice(info.after_line-1,1);
 else rows[info.after_line-1]=replacement;
 file.text=rows.join('\n');
 state.matchReviews.clear();invalidate();updateCounts();
 window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after',source:'qc'}}));
 qcFeedback(`${verb} · ${info.image_id} · A${info.after_line}. Nhãn A đã cập nhật trong phiên; tải ZIP nhãn A để lưu. Đối chiếu B–A cần chạy lại.`);
 scheduleQC();
}
function qcDelete(info,expected){
 try{
  requireUnchanged(info,expected);
  const message=`Xóa đúng 1 box A dòng ${info.after_line} trong ${info.image_id}?\n\nMã QC: ${info.check_code}. Box có thể là đối tượng thật, hãy kiểm tra ảnh trước khi xóa.\n\nChỉ nhãn A trong phiên bị sửa; B và ảnh gốc được giữ nguyên.`;
  if(!window.confirm(message))return;
  commitQCLine(info,expected,null,'Đã xóa box A');
 }catch(e){qcFeedback(e.message,true);}
}
function qcClampTiny(info,expected){
 try{
  requireUnchanged(info,expected);
  const parts=expected.split(/\s+/);if(parts.length!==5)throw Error('Dòng TXT không hợp lệ.');
  const g=parts.slice(1).map(Number),[x,y,w,h]=g;
  if(g.some(v=>!Number.isFinite(v))||w<=0||h<=0)throw Error('Không thể cắt biên nhãn sai cấu trúc.');
  const left=x-w/2,top=y-h/2,right=x+w/2,bottom=y+h/2;
  const exceed=Math.max(0,-left,-top,right-1,bottom-1);
  if(exceed<=0||exceed>1e-5+1e-12)throw Error('Chỉ được cắt biên tự động khi vượt không quá 0,00001.');
  const x1=Math.max(0,left),y1=Math.max(0,top),x2=Math.min(1,right),y2=Math.min(1,bottom);
  if(!(x2>x1&&y2>y1))throw Error('Cắt biên làm mất box. Hãy sửa thủ công.');
  if(!window.confirm(`Cắt sai số vượt biên ${exceed.toExponential(2)} của box A${info.after_line} (${info.image_id})?\n\nChỉ cắt vào [0,1], không tự suy đoán vật thể. Nhãn A sẽ được cập nhật trong phiên.`))return;
  const f=n=>Number(n.toFixed(12)).toString();
  commitQCLine(info,expected,[parts[0],f((x1+x2)/2),f((y1+y2)/2),f(x2-x1),f(y2-y1)].join(' '),'Đã cắt sai số biên nhỏ');
 }catch(e){qcFeedback(e.message,true);}
}
function showRawEditor(info,expected){
 try{
  requireUnchanged(info,expected);
  const modal=$('qcRawEditModal');
  $('qcRawEditTarget').textContent=`${info.image_id} · A${info.after_line} · ${info.check_code}`;
  $('qcRawEditText').value=expected;
  $('qcRawEditError').textContent='';modal.hidden=false;
  $('qcRawEditText').focus();$('qcRawEditText').select();
  const close=()=>{modal.hidden=true;$('qcRawEditSave').onclick=null;$('qcRawEditCancel').onclick=null;};
  $('qcRawEditCancel').onclick=close;
  $('qcRawEditSave').onclick=()=>{
   try{
    const raw=$('qcRawEditText').value.trim();if(raw.includes('\n')||raw.includes('\r'))throw Error('Chỉ được sửa một dòng TXT.');
    const p=raw.split(/\s+/);
    if(p.length!==5||!/^[0-3]$/.test(p[0])||p.slice(1).some(v=>!floatPattern.test(v)))throw Error('Phải có: class 0–3, x_center, y_center, width, height (5 cột).');
    const [x,y,w,h]=p.slice(1).map(Number);
    if([x,y,w,h].some(v=>!Number.isFinite(v))||w<=0||h<=0)throw Error('Tọa độ phải hữu hạn; width và height phải > 0.');
    if(x-w/2<0||y-h/2<0||x+w/2>1||y+h/2>1)throw Error('Box vẫn vượt biên [0,1]. Nhập lại tọa độ; không tự cắt biên làm lệch nhãn.');
    commitQCLine(info,expected,raw,'Đã sửa dòng TXT A');close();
   }catch(e){$('qcRawEditError').textContent=e.message;}
  };
 }catch(e){qcFeedback(e.message,true);}
}
async function qcEdit(info,expected){
 try{
  requireUnchanged(info,expected);
  if(!window.MatchReview?.getImageFile?.(info.image_id))throw Error('Thiếu ảnh gốc cùng image_id. Hãy nạp ảnh tại mục 01 trước khi sửa trực quan.');
  await window.YoloCoords.focusQCBox(info.image_id,info.after_line,info.check_code);
 }catch(e){
  // Nếu một dòng sai cấu trúc làm cả TXT không đọc được ở mục 05, đưa về editor an toàn ở QC.
  qcFeedback('Chưa thể mở mục 05: '+e.message+' Dùng “Sửa TXT” ở mục 02 nếu tệp có dòng hỏng.',true);
 }
}
// Batch remediation is deliberately opt-in. Group by image_id and commit once
// so labels are not repeatedly rescanned/repainted after every deleted row.
// Member filter is driven by the OFFICIAL assignment manifest, never by guessed ZIP paths.
const qcMemberSelect=$('qcMemberFilter');
let qcOwnerCache=new Map();
function refreshQCMemberOptions(){
 if(!qcMemberSelect)return;
 const selected=qcMemberSelect.value,owners=new Map(),countByMember=new Map();
 if(state.manifest?.fields?.includes('assigned_reviewer_id')){
  for(const row of state.manifest.rows){
   const id=canonicalManifestId(row.image_id),member=String(row.assigned_reviewer_id||'').trim();
   if(id&&member){owners.set(id,member);countByMember.set(member,(countByMember.get(member)||0)+1);}
  }
 }
 qcOwnerCache=owners;qcMemberSelect.replaceChildren();
 const all=document.createElement('option');all.value='all';all.textContent='Tất cả thành viên';qcMemberSelect.append(all);
 for(const member of [...countByMember.keys()].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}))){
  const option=document.createElement('option');option.value=member;option.textContent=member+' · '+countByMember.get(member)+' ảnh';qcMemberSelect.append(option);
 }
 qcMemberSelect.value=countByMember.has(selected)?selected:'all';qcMemberSelect.disabled=!countByMember.size;
}
function memberIssueMatch(issue){const selected=qcMemberSelect?.value||'all';return selected==='all'||qcOwnerCache.get(issue.image_id)===selected;}
const batchModes=[
 ['HEIGHT_LT_12PX','qcQuickHeight'],
 ['WIDTH_LT_1PX','qcQuickWidth'],
 ['DUPLICATE_EXACT','qcQuickDuplicate'],
 ['CLAMP_TINY','qcQuickClamp']
];
function refreshQuickActions(){
 for(const [code,id] of batchModes){
  const btn=$(id);if(!btn)continue;
  const unique=new Set(issues.filter(e=>e.check_code===code&&e.after_line>0&&memberIssueMatch(e)).map(e=>e.image_id+'::'+e.after_line));
  btn.disabled=!unique.size||scanning||lastCompleteRevision!==qcRevision;
  const count=btn.querySelector('[data-count]');if(count)count.textContent=String(unique.size);
 }
}
function quickBatch(code){
 try{
  if(scanning||lastCompleteRevision!==qcRevision)throw Error('Dữ liệu A vừa thay đổi hoặc QC đang kiểm tra. Hãy chạy QC lại trước khi xử lý nhanh.');
  const matching=issues.filter(e=>e.check_code===code&&e.after_line>0&&memberIssueMatch(e));
  const byId=new Map();
  for(const e of matching){let group=byId.get(e.image_id);if(!group){group=new Map();byId.set(e.image_id,group);}group.set(e.after_line,e);}
  const count=[...byId.values()].reduce((n,g)=>n+g.size,0);
  if(!count){qcFeedback('Không còn cảnh báo loại này.',false);return;}
  const clamp=code==='CLAMP_TINY';
  const names={HEIGHT_LT_12PX:'box cao dưới 12px',WIDTH_LT_1PX:'box rộng dưới 1px',DUPLICATE_EXACT:'box trùng hoàn toàn',CLAMP_TINY:'box vượt biên rất nhỏ'};
  const fileMap=nameMap(state.after),changes=[];
  // Validate every candidate before asking for confirmation, then apply atomically.
  for(const [id,group] of byId){
   const file=fileMap.get(id);if(!file)throw Error('Không tìm thấy TXT A cho '+id);
   const rows=file.text.replace(/^\uFEFF/,'').split(/\r?\n/),edits=[];
   for(const [line,e] of group){
    const raw=rows[line-1]?.trim();
    if(!raw||raw!==originalLine(e))throw Error('Nhãn A đã thay đổi. Hãy chạy QC lại trước khi xử lý.');
    if(!clamp){edits.push({line,replacement:null});continue;}
    const parts=raw.split(/\s+/),[x,y,w,h]=parts.slice(1).map(Number);
    if(parts.length!==5||[x,y,w,h].some(n=>!Number.isFinite(n))||w<=0||h<=0)throw Error('Không thể cắt biên tại '+id+' dòng '+line);
    const x1=x-w/2,y1=y-h/2,x2=x+w/2,y2=y+h/2;
    const exceed=Math.max(0,-x1,-y1,x2-1,y2-1);
    if(exceed<=0||exceed>1e-5+1e-12)throw Error('Sai số biên không còn trong ngưỡng an toàn. Kiểm tra lại.');
    const l=Math.max(0,x1),t=Math.max(0,y1),r=Math.min(1,x2),b=Math.min(1,y2);
    if(r<=l||b<=t)throw Error('Box không hợp lệ sau cắt biên.');
    const fmt=n=>Number(n.toFixed(12)).toString();
    edits.push({line,replacement:[parts[0],fmt((l+r)/2),fmt((t+b)/2),fmt(r-l),fmt(b-t)].join(' ')});
   }
   changes.push({file,rows,edits});
  }
  const sample=[...byId].flatMap(([id,group])=>[...group.keys()].slice(0,3).map(n=>`${id} · A${n}`)).slice(0,7).join('\n');
  const action=clamp?'Cắt biên':'Xóa';
  if(!window.confirm(`${action} ${count} ${names[code]} trong ${byId.size} ảnh?\n\n${sample}${count>7?'\n…':''}\n\n${clamp?'Chỉ cắt sai số ≤ 0,00001; không tự suy đoán vật thể.':'Box có thể là vật thể thật. Chỉ tiếp tục sau khi đã rà soát ảnh.'}\n\nChỉ thay đổi nhãn A trong phiên. Nhãn B và file gốc trên máy không bị sửa.`))return;
  for(const {file,rows,edits} of changes){
   for(const edit of edits.sort((a,b)=>b.line-a.line)){
    if(edit.replacement===null)rows.splice(edit.line-1,1);
    else rows[edit.line-1]=edit.replacement;
   }
   file.text=rows.join('\n');
  }
  state.matchReviews.clear();invalidate();updateCounts();
  window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after',source:'qc-batch'}}));
  qcFeedback(`Đã ${clamp?'cắt biên':'xóa'} ${count} box A thuộc ${byId.size} ảnh. Tải lại nhãn A để lưu; kết quả B–A cần đối chiếu lại.`);
  scheduleQC();
 }catch(e){qcFeedback('Xử lý nhanh không thành công: '+e.message,true);}
}
for(const [code,id] of batchModes){$(id)?.addEventListener('click',()=>quickBatch(code));}

// Non-mutating preview: show the original image and highlight the exact QC box.
// Keep this separate from the edit/delete flows and the old <12px warning list.
let qcPreviewRequest=0;
async function qcView(info,raw){
 const preview=$('qcShortPreview'),title=$('qcShortPreviewTitle'),grid=preview.querySelector('.qcShortPreviewGrid');
 const request=++qcPreviewRequest;
 preview.hidden=false;grid.hidden=true;
 title.textContent=`Đang xem ${info.image_id||'ảnh'}${info.after_line?' · A'+info.after_line:''}…`;
 preview.scrollIntoView({behavior:'smooth',block:'nearest'});
 const file=info.image_id&&window.MatchReview?.getImageFile?.(info.image_id);
 if(!file){title.textContent=`${info.image_id||'Ảnh'} · Chưa nạp ảnh gốc. Hãy bổ sung ảnh tại mục 01 để xem trực quan.`;return;}
 let imageUrl;
 try{
  imageUrl=URL.createObjectURL(file);
  const img=await new Promise((resolve,reject)=>{
   const element=new Image();
   element.onload=()=>resolve(element);
   element.onerror=()=>reject(Error('Không đọc được ảnh gốc.'));
   element.src=imageUrl;
  });
  if(request!==qcPreviewRequest||preview.hidden)return;
  const W=img.naturalWidth,H=img.naturalHeight;
  const values=typeof raw==='string'?raw.trim().split(/\s+/):[];
  const g=values.length===5?values.slice(1).map(Number):null;
  const valid=!!g&&g.every(Number.isFinite)&&g[2]>0&&g[3]>0;
  const titleSuffix=valid?` · ${info.check_code||'QC'}`:' · TXT không có tọa độ box hợp lệ, chỉ xem ảnh';
  title.textContent=`${info.image_id} · ${info.after_line?'A'+info.after_line+' · ':''}${W} × ${H}${titleSuffix}`;
  const whole=$('qcShortOverviewCanvas'),crop=$('qcShortCropCanvas');
  const scale=Math.min(840/W,440/H,1);
  whole.width=Math.max(1,Math.round(W*scale));whole.height=Math.max(1,Math.round(H*scale));
  const c=whole.getContext('2d');c.clearRect(0,0,whole.width,whole.height);c.drawImage(img,0,0,whole.width,whole.height);
  crop.width=360;crop.height=240;
  const zoom=crop.getContext('2d');zoom.clearRect(0,0,crop.width,crop.height);
  if(valid){
   const [cx,cy,bw,bh]=g;
   c.save();c.strokeStyle='#e54146';c.lineWidth=3;
   c.strokeRect((cx-bw/2)*whole.width,(cy-bh/2)*whole.height,Math.max(2,bw*whole.width),Math.max(2,bh*whole.height));c.restore();
   const centerX=cx*W,centerY=cy*H;
   const half=Math.max(55,Math.max(bw*W,bh*H)*2.5);
   const cropW=Math.min(W,half*3),cropH=Math.min(H,cropW*2/3);
   const sx=Math.min(Math.max(0,centerX-cropW/2),Math.max(0,W-cropW));
   const sy=Math.min(Math.max(0,centerY-cropH/2),Math.max(0,H-cropH));
   zoom.drawImage(img,sx,sy,cropW,cropH,0,0,crop.width,crop.height);
   zoom.strokeStyle='#e54146';zoom.lineWidth=3;
   zoom.strokeRect(((cx-bw/2)*W-sx)*crop.width/cropW,((cy-bh/2)*H-sy)*crop.height/cropH,Math.max(2,bw*W*crop.width/cropW),Math.max(2,bh*H*crop.height/cropH));
  }else zoom.drawImage(img,0,0,W,H,0,0,crop.width,crop.height);
  grid.hidden=false;
 }catch(e){if(request===qcPreviewRequest)title.textContent=`Không thể xem ${info.image_id||'ảnh'}: ${e.message}`;}
 finally{if(imageUrl)URL.revokeObjectURL(imageUrl);}
}
$('qcPreviewClose')?.addEventListener('click',()=>{qcPreviewRequest++;});
function renderFindings(){
 const filter=$('qcSeverityFilter').value;
 const codeSelect=$('qcCodeFilter');
 const previous=codeSelect.value;
 const counts=new Map();for(const finding of issues){if(finding.check_code)counts.set(finding.check_code,(counts.get(finding.check_code)||0)+1);}
 const codes=[...counts.keys()].sort((a,b)=>a.localeCompare(b));
 const friendly={HEIGHT_LT_12PX:'Box cao dưới 12 px',WIDTH_LT_1PX:'Box rộng dưới 1 px',DUPLICATE_EXACT:'Box trùng hoàn toàn',NEAR_DUPLICATE:'Box gần trùng',OUT_OF_BOUNDS:'Box vượt biên',CENTER_OUTSIDE:'Tâm box ngoài ảnh',CLAMP_TINY:'Vượt biên rất nhỏ',MISSING_LABEL:'Thiếu nhãn',EXTRA_LABEL:'Dư nhãn',IMAGE_MISSING:'Thiếu ảnh gốc',IMAGE_DECODE:'Không đọc được ảnh'};
 codeSelect.replaceChildren(new Option('Tất cả loại sai','all'));
 for(const code of codes)codeSelect.add(new Option((friendly[code]||code)+' · '+counts.get(code),code));
 codeSelect.value=codes.includes(previous)?previous:'all';
 const codeFilter=codeSelect.value;
 const codeItems=$('qcCodeFilterItems');codeItems.replaceChildren();
 for(const code of ['all',...codes]){
  const btn=document.createElement('button');btn.type='button';btn.dataset.code=code;
  btn.setAttribute('aria-pressed',String(code===codeFilter));
  const left=document.createElement('span');left.textContent=code==='all'?'Tất cả loại sai':friendly[code]||code;
  const count=document.createElement('b');count.textContent=String(code==='all'?issues.length:counts.get(code));
  btn.append(left,count);btn.addEventListener('click',()=>{codeSelect.value=code;$('qcCodeFilterMenu').open=false;renderFindings();});codeItems.append(btn);
 }
 $('qcCodeFilterSelected').textContent=codeFilter==='all'?'Tất cả loại sai':friendly[codeFilter]||codeFilter;
 const findings=issues.filter(x=>(filter==='all'||x.severity===filter)&&(codeFilter==='all'||x.check_code===codeFilter)&&memberIssueMatch(x));
 const rows=$('afterQcRows');rows.replaceChildren();const limit=100;
 const afterMap=nameMap(state.after),canOpenCache=new Map(),linesCache=new Map();
 function readOriginal(entry){
  let lines=linesCache.get(entry.image_id);
  if(!lines){lines=afterMap.get(entry.image_id)?.text.replace(/^\uFEFF/,'').split(/\r?\n/)||[];linesCache.set(entry.image_id,lines);}
  return lines[entry.after_line-1]?.trim()??null;
 }
 function canOpenId(id){
  if(canOpenCache.has(id))return canOpenCache.get(id);
  let result=false;try{parseLabels(afterMap.get(id),false);result=true;}catch{}
  canOpenCache.set(id,result);return result;
 }
 for(const entry of findings.slice(0,limit)){
  const tr=document.createElement('tr');tr.className='qc'+entry.severity;
  const values=[severityTitle[entry.severity],entry.image_id||'—',entry.after_line?'A'+entry.after_line:'—',entry.class_name||'—',entry.check_code,entry.message];
  for(const [i,value] of values.entries()){const td=document.createElement('td');td.textContent=value;if(i===0)td.className='qcSeverityCell '+entry.severity;if(i===4)td.className='qcCodeCell';tr.append(td);}
  const action=document.createElement('td'),group=document.createElement('div');group.className='qcInlineActions';
  const expected=entry.after_line>0?readOriginal(entry):null;
  const make=(label,handler,kind='')=>{
   const b=document.createElement('button');b.type='button';b.className='qcIssueAction qcIconAction'+(kind?' '+kind:'');
   b.title=label;b.setAttribute('aria-label',label+' · '+(entry.image_id||'ảnh')+' · '+(entry.after_line?'A'+entry.after_line:'QC'));
   const paths={
    'Xem':'<circle cx="11" cy="11" r="3"/><path d="M2 11s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>',
    'Chỉnh sửa':'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/>',
    'Sửa TXT':'<path d="M5 3h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M7 13h6M7 17h4"/>',
    'Xóa':'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v7M14 10v7"/>',
    'Bỏ trùng':'<rect x="3" y="3" width="12" height="12" rx="2"/><path d="M9 19h9a2 2 0 0 0 2-2V8M7 9l4 4m0-4-4 4"/>',
    'Cắt biên':'<path d="M4 4v7h7M20 20v-7h-7M4 11V4h7M20 13v7h-7"/>',
    'Sửa số':'<path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L9 17l-4 1 1-4z"/>',
    'Đến dữ liệu':'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/><path d="M12 11v6m-3-3 3 3 3-3"/>'};
   b.innerHTML='<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[label]||paths['Chỉnh sửa'])+'</svg>';
   b.addEventListener('click',handler);group.append(b);return b;
  };
  if(entry.image_id)make('Xem',()=>void qcView(entry,expected),'is-view');
  if(entry.after_line>0&&qcLineCodes.has(entry.check_code)&&expected!==null){
   if(qcStructuralCodes.has(entry.check_code))make('Sửa TXT',()=>showRawEditor(entry,expected));
   else{
    const canOpen=canOpenId(entry.image_id);
    if(canOpen)make('Chỉnh sửa',()=>void qcEdit(entry,expected),'is-edit');
    else make('Sửa TXT',()=>showRawEditor(entry,expected),'is-edit');
    if(entry.check_code==='CLAMP_TINY')make('Cắt biên',()=>qcClampTiny(entry,expected),'is-quick');
    if(canOpen&&['OUT_OF_BOUNDS','CENTER_OUTSIDE'].includes(entry.check_code))make('Sửa số',()=>showRawEditor(entry,expected));
   }
   make(entry.check_code==='DUPLICATE_EXACT'?'Bỏ trùng':'Xóa',()=>{
    if(entry.check_code==='HEIGHT_LT_12PX'&&window.QCShortBoxes?.deleteOne?.(entry.image_id,entry.after_line))return;
    qcDelete(entry,expected);
   },'is-delete');
  }
  if(entry.check_code==='MISSING_LABEL'||entry.check_code==='EXTRA_LABEL'||entry.check_code==='IMAGE_MISSING'){
   make('Đến dữ liệu',()=>document.getElementById('uploadHub')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  if(!group.children.length)group.textContent='—';action.append(group);tr.append(action);rows.append(tr);
 }
 $('afterQcMore').textContent=findings.length>limit?`Hiển thị ${limit}/${findings.length} vấn đề. Tải CSV để xem toàn bộ.`:`${findings.length} mục trong bộ lọc hiện tại.`;
 $('afterQcTableWrap').hidden=!findings.length;
 const empty=$('qcNoFindings');empty.hidden=!!findings.length;
 if(!state.after.length)empty.textContent='Chưa có nhãn A. Nạp tệp tại mục 01.';
 else if(!findings.length&&issues.length)empty.textContent='Không có vấn đề ở mức độ đã chọn.';
 else if(!findings.length)empty.textContent='Không phát hiện vấn đề theo các quy tắc QC đã chạy. Xem các mục “chưa kiểm” phía trên trước khi kết luận.';
}

function display(){
 const el=$('afterQcStatus'),download=$('afterQcDownload');download.disabled=!state.after.length;
 if(!state.after.length){el.textContent='Chưa nạp nhãn A. Nạp tại mục 01 để kiểm tra.';el.className='qcStatus is-pending';}
 else{
  const errorCount=issues.filter(i=>i.severity==='ERROR').length,warningCount=issues.filter(i=>i.severity==='WARNING').length;
  el.textContent=scanning?'Đang kiểm tra kích thước pixel trên ảnh gốc…':errorCount?'Có lỗi cần sửa trước khi xuất dữ liệu.':warningCount?'Không có lỗi nghiêm trọng; còn cảnh báo cần xem.':'Không phát hiện lỗi trong các phép kiểm đã chạy. Các mục chưa đủ dữ liệu được ghi riêng bên dưới.';
  el.className='qcStatus '+(errorCount?'is-bad':warningCount?'is-warn':'is-good');
 }
 renderOverview();renderCoverage();renderRules();renderFindings();refreshQuickActions();
}
async function downloadQC(){
 if(!state.after.length){status('Chưa có nhãn A để kiểm tra.',true);return;}
 const complete=await scanQC();if(!complete){qcRunNotice('Không thể tải báo cáo vì lượt QC chưa hoàn tất.','error');return;}
 try{
  const fields=['severity','image_id','after_line','class_name','check_code','message'];
  const data=window.YoloDiff.csv(fields,issues),url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='qc_nhan_A_sau_sua.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){qcRunNotice('Không thể tạo báo cáo QC: '+e.message,'error');}
}
// Đóng hộp sửa dòng bằng Escape hoặc nhấp vùng ngoài.
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('qcRawEditModal').hidden){event.preventDefault();event.stopPropagation();$('qcRawEditCancel').click();}
},true);
$('qcRawEditModal').addEventListener('click',event=>{if(event.target===$('qcRawEditModal'))$('qcRawEditCancel').click();});
$('afterQcDownload').addEventListener('click',downloadQC);
$('qcLabels').addEventListener('click',()=>{clearTimeout(scanTimer);void scanQC({manual:true});});
$('qcSeverityFilter').addEventListener('change',renderFindings);
$('qcCodeFilter').addEventListener('change',renderFindings);
qcMemberSelect?.addEventListener('change',()=>{renderFindings();refreshQuickActions();});
$('normalize')?.addEventListener('change',()=>{qcRevision++;refreshQuickActions();scheduleQC();});
window.addEventListener('yolo:labels-updated',event=>{if(event.detail?.side==='after'){qcRevision++;refreshQuickActions();scheduleQC();}});
window.addEventListener('yolo:manifest-updated',()=>{refreshQCMemberOptions();refresh();scheduleQC();});
let scanTimer;
function scheduleQC(){
 clearTimeout(scanTimer);
 const feedback=$('qcRunFeedback');
 const announce=!!feedback&&!feedback.hidden&&activeManualScan===0;
 if(announce)qcRunNotice('Dữ liệu vừa thay đổi · QC đang tự cập nhật…','running');
 scanTimer=setTimeout(async()=>{
  const ok=await scanQC();
  if(ok&&announce&&activeManualScan===0){
   const errors=issues.filter(e=>e.severity==='ERROR').length;
   const warnings=issues.filter(e=>e.severity==='WARNING').length;
   qcRunNotice(`QC đã tự cập nhật · ${state.after.length} TXT / ${qcMetrics.boxes} box · ${errors} lỗi, ${warnings} cảnh báo.`,errors?'warning':'done');
  }
 },280);
}
refreshQCMemberOptions();
window.YoloAfterQC={scan:scanQC,inspectSync:evaluateSync,assertValid,assertScope,assertCoverage,download:downloadQC,getSnapshot:()=>({issues:issues.map(x=>({...x})),metrics:{...qcMetrics},scanning})};
window.YoloUploadHub={refresh,go:()=>hub.scrollIntoView({behavior:'smooth',block:'start'})};
refresh();scheduleQC();
})();
