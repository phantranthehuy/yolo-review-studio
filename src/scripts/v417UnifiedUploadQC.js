/* v4.1.8.4 — queued single upload, skip JSON, A/B role confirmation and QC. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const hub=$('uploadHub');if(!hub)return;
const getImages=()=>window.MatchReview?.listImageIds?.()||[];
const getAfterImages=()=>window.MatchReview?.listAfterImageIds?.()||[];
const hubRoleLabels={before:'B — nhãn ban đầu',after:'A — nhãn sau sửa',gold:'Nhãn tham chiếu / Ground Truth',intergroupSource:'Nhãn đã sửa của nhóm nguồn (intergroup)',skip:'Bỏ qua nhóm này'};
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
 state.manifest=null;state.fileOrigins.manifest='';state.manifestScope='all';state.selectedMember='';$('manifestFile').value='';$('manifestName').textContent='Chưa có assignment_manifest.csv. Đang dùng ảnh của hai bộ nhãn.';
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
const roleNames=['before','after','gold','intergroupSource','skip'];
const knownBefore=/(?:^|[\W_])(?:before|original|originals|initial|baseline|raw|pre[-_ ]?edit|nhan[-_ ]?goc|nhan[-_ ]?ban[-_ ]?dau|labels?[-_]?b)(?:$|[\W_])/i;
const knownAfter=/(?:^|[\W_])(?:after|edited|corrected|revised|post[-_ ]?edit|nhan[-_ ]?sau|nhan[-_ ]?da[-_ ]?sua|labels?[-_]?a)(?:$|[\W_])/i;
const knownGold=/(?:^|[\W_])(?:gold|ground[-_ ]?truth|gt[-_]?labels?|reference[-_ ]?labels?|nhan[-_ ]?chuan)(?:$|[\W_])/i;
function suggestRole(group){const s=group.toLowerCase();return knownGold.test(s)?'gold':/(?:^|\/\s*)(?:G\d{2})$/i.test(group.trim())?'before':/(?:TRAFFIC_G\d{2}_REVIEW|\.yolov8\.zip|(?:^|\/)train\/labels)/i.test(s)?'after':s==='b'||knownBefore.test(s)?'before':s==='a'||knownAfter.test(s)?'after':'';}
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
   const bytes=await entry.async('uint8array');if(bytes.byteLength>200*1024*1024)throw Error('Tệp bên trong ZIP quá lớn');out.push(fileFromBytes(bytes,name,file.name+'/'+entry.name));
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
 const keys=[...groups.keys()];const inferred=keys.map(k=>suggestRole(k));
 // If B/A are both present, show both in one dialog, with suggested assignments visible.
 if(keys.length===2&&inferred.every(x=>!x)){
   if(!state.before.length&&!state.after.length){inferred[0]='before';inferred[1]='after';}
   else if(state.before.length&&!state.after.length)inferred[0]='after';
   else if(!state.before.length&&state.after.length)inferred[0]='before';
 }
 const selects=[];
 for(let i=0;i<keys.length;i++){const key=keys[i],list=groups.get(key),row=document.createElement('label');row.className='hubRoleRow';
  const info=document.createElement('span');info.innerHTML='';const n=document.createElement('strong');n.textContent=key;const count=document.createElement('small');count.textContent=`${list.length} tệp TXT · ví dụ ${list.slice(0,2).map(x=>x.name).join(', ')}`;info.append(n,count);
  const select=document.createElement('select');select.className='hubRoleSelect';select.setAttribute('aria-label','Vai trò của '+key);for(const role of roleNames){const option=document.createElement('option');option.value=role;option.textContent=hubRoleLabels[role];select.append(option);}
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
   const duplicate=roles.find((r,i)=>roles.indexOf(r)!==i);if(duplicate){error.textContent=`Có hai thư mục đang cùng gán ${hubRoleLabels[duplicate]}. Hãy chọn đúng từng bộ hoặc bỏ qua thư mục không dùng.`;return;}
   close(assignments.filter(g=>g.role!=='skip'));
  };
 });
}
async function autoRouteMetadata(file,notices){const name=file.name.toLowerCase();
 try{
 if(/\.ya?ml$/i.test(name)){setInputFiles('classesFile',[file]);notices.push(`YAML: ${file.name}`);return;}
 if(/\.csv$/i.test(name)){
  const header=(await file.text()).replace(/^\ufeff/,'').split(/\r?\n/,1)[0].split(',').map(c=>c.trim().replace(/^"|"$/g,'').toLowerCase());
  const all=arr=>arr.every(c=>header.includes(c));
  let id=null;
  if(all(['image_id','reviewer_id','review_status','boxes_added','boxes_removed','boxes_modified','reviewed_at','notes','revision','class_changes','geometry_changes']))id='schemaFile';
  else if(header.includes('image_id')&&(header.includes('assigned_reviewer_id')||header.includes('filename')||header.includes('difficulty_weight')||/manifest|assigned|phan_cong/i.test(name)))id='manifestFile';
  else if(header.includes('image_id')&&(header.length<=2||/eval|ids|danh_sach/i.test(name)))id='evalIdsFile';
  if(id){setInputFiles(id,[file]);notices.push(`CSV: ${file.name}`);}else notices.push(`CSV ${file.name}: chưa xác định được mục đích, đã bỏ qua để tránh nhập nhầm.`);
  return;
 }
 }catch(error){notices.push(`Không đọc được ${file.name}: ${error.message}`);}
}
// Serialize uploads instead of rejecting a second batch while a B/A confirmation dialog is open.
// Each completed/cancelled/error batch releases the slot and the next one is processed.
let loading=false;
const uploadQueue=[];
const inFlightBatches=new Set();
function batchFingerprint(files){return files.map(f=>`${pathOf(f)}:${f.size}:${f.lastModified}`).sort().join('\n');}
function ingest(raw){
 const incoming=Array.from(raw||[]);
 const skippedJson=incoming.filter(file=>/\.json$/i.test(file.name)).length;
 const files=incoming.filter(file=>!/\.json$/i.test(file.name));
 if(!files.length){
  if(skippedJson)status(`Đã bỏ qua ${skippedJson} tệp JSON. JSON không được nạp vào dữ liệu chung.`,false);
  return Promise.resolve();
 }
 const key=batchFingerprint(files);
 if(inFlightBatches.has(key)){
  status('Bộ dữ liệu này đã được nhận và đang xử lý. Hãy xác nhận hoặc hủy trong cửa sổ đang mở; không cần chọn lại.',false);
  return Promise.resolve();
 }
 inFlightBatches.add(key);
 return new Promise(resolve=>{
  uploadQueue.push({files,key,resolve,skippedJson});
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
   try{await processUploadBatch(task.files,task.skippedJson);}
   catch(error){status('Lỗi nạp dữ liệu: '+error.message,true);}
   finally{inFlightBatches.delete(task.key);task.resolve();}
  }
 }finally{loading=false;}
}
async function processUploadBatch(raw,initialSkippedJson=0){
 const failures=[],messages=[];status(`Đang phân loại ${raw.length} tệp/thư mục…`);
 try{
  const expanded=await expandSources(raw);failures.push(...expanded.failed);const files=expanded.files;
  const skippedJson=initialSkippedJson+expanded.skippedJson.length;const skippedExportImages=expanded.skippedExportImages?.length||0;
  const inter=window.YoloIntergroup?.classify(files)||{main:files,data:null};const mainFiles=inter.main;const groups=buildGroups(mainFiles),images=mainFiles.filter(f=>imageExt.test(f.name)&&!/\/\._/.test(pathOf(f))),other=mainFiles.filter(f=>/\.(?:csv|yaml|yml)$/i.test(f.name));
  let assignments=[];
  if(groups.size){
   status(`Đã tìm thấy ${groups.size} nhóm nhãn TXT. Hãy chọn nhãn B/A trong cửa sổ xác nhận hoặc bấm “Hủy nạp”.`,false);
   assignments=await roleModal(groups);
   if(assignments===null){status('Đã hủy lượt chọn nhãn. Dữ liệu trước đó vẫn giữ nguyên.');return;}
  }
  // A source Roboflow export used for intergroup must NOT put its images/YAML into main.
  const intergroupSourceZipRoots=new Set(assignments.filter(a=>a.role==='intergroupSource').flatMap(a=>a.files.map(f=>partsOf(pathOf(f))[0])).filter(r=>/\.zip$/i.test(r)));
  const isSourceZipFile=f=>intergroupSourceZipRoots.has(partsOf(pathOf(f))[0]);
  // Only after confirmation: apply the staged batch. Keep B, A and GT independent.
  for(const a of assignments){if(a.role==='intergroupSource'){messages.push(await window.YoloIntergroup.ingestSource(a.files));continue;}setInputFiles(a.role==='before'?'beforeFiles':a.role==='after'?'afterFiles':'goldFiles',a.files);await waitForNative();messages.push(`${a.key} → ${hubRoleLabels[a.role]} (${a.files.length} TXT)`);}
  if(inter.data&&(inter.data.assign.length||inter.data.image.length||inter.data.baseline.length||inter.data.source.length)){messages.push(await window.YoloIntergroup.ingest(inter.data));}
  const mainImages=images.filter(f=>!isSourceZipFile(f));
  if(mainImages.length){const afterImages=mainImages.filter(f=>/(?:^|\/)(?:after[_-]?images|images[_-]?after|anh[_-]?sau)\//i.test(pathOf(f)));
   const originals=mainImages.filter(f=>!afterImages.includes(f));
   if(originals.length){const ok=await window.MatchReview.addImages(originals);if(ok)messages.push(`${originals.length} ảnh gốc`);else failures.push('Không nạp được một số ảnh gốc; xem thông báo mục 04.');}
   if(afterImages.length){const ok=await window.MatchReview.addAfterImages(afterImages);if(ok)messages.push(`${afterImages.length} ảnh sau riêng`);else failures.push('Không nạp được ảnh sau riêng.');}
  }
  for(const f of other.filter(f=>!isSourceZipFile(f))){await autoRouteMetadata(f,messages);await waitForNative();}
  refresh();window.YoloAfterQC?.scan?.();
  if(skippedExportImages)messages.push(`Bỏ qua ${skippedExportImages} ảnh export Roboflow để bảo toàn ảnh gốc từ Gxx`);const summary=messages.length?`Đã nhận: ${messages.join(' · ')}.`:'Chưa nhận diện được tệp có thể sử dụng.';
  status(summary+(skippedJson?` Đã bỏ qua ${skippedJson} tệp JSON.`:'')+(failures.length?' Lỗi: '+failures.join('; '):''),!!failures.length);
 }catch(error){status('Không thể xử lý dữ liệu: '+error.message,true);}
}
// Clear the native file input immediately; the same file/folder can be selected again
// after cancellation, even if the batch is still awaiting role confirmation.
for(const inputId of ['hubAnyFiles','hubAnyFolder']){
 $(inputId).onchange=e=>{const selected=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';void ingest(selected);};
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
function evaluateSync(){
 issues=[];
 const images=new Set(getImages()),seenNames=new Map();
 unknownImageCount=0;
 qcMetrics={boxes:0,validBoxes:0,pixelScanned:0,matchedImages:0,coverage:getCoverage()};
 for(const file of state.after){
  const id=cleanId(file.name,$('normalize').checked);
  if(seenNames.has(id))issue('ERROR',id,0,'','DUPLICATE_IMAGE_ID',`Trùng ID chuẩn hóa giữa ${seenNames.get(id)} và ${file.name}.`);
  else seenNames.set(id,file.name);
  if(!id||id==='.'||id==='..')issue('ERROR',id,0,'','BAD_IMAGE_ID','ID ảnh rỗng/không hợp lệ.');
  const seenExact=new Map(),boxes=[],lines=file.text.replace(/^\uFEFF/,'').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const raw=lines[i].trim();if(!raw)continue;
   qcMetrics.boxes++;
   const p=raw.split(/\s+/),line=i+1;
   if(p.length!==5){issue('ERROR',id,line,'','COLUMN_COUNT',`Cần đúng 5 cột class x_center y_center width height; hiện có ${p.length}.`);continue;}
   const cls=Number(p[0]),name=/^[0-3]$/.test(p[0])?typeNames[cls]:'';
   if(!/^[0-3]$/.test(p[0])){issue('ERROR',id,line,'','CLASS_ID','class_id phải là số nguyên 0, 1, 2 hoặc 3.');continue;}
   if(p.slice(1).some(n=>!floatPattern.test(n))){issue('ERROR',id,line,name,'INVALID_NUMBER','Tọa độ không phải số YOLO hợp lệ (không nhận NaN, Infinity, dấu phẩy hoặc ký tự lạ).');continue;}
   const g=p.slice(1).map(Number);if(g.some(n=>!Number.isFinite(n))){issue('ERROR',id,line,name,'NONFINITE','Tọa độ vượt miền số hữu hạn.');continue;}
   const [x,y,w,h]=g;
   if(w<=0||h<=0){issue('ERROR',id,line,name,'NONPOSITIVE_SIZE','Chiều rộng và chiều cao phải lớn hơn 0.');continue;}
   qcMetrics.validBoxes++;
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
  for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){
   const a=boxes[i],b=boxes[j];if(a.cls!==b.cls)continue;
   const ix=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
   const iy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
   const overlap=ix*iy,union=a.w*a.h+b.w*b.h-overlap;
   if(overlap>0&&union>0&&overlap/union>=.995&&[a.cls,...a.g].join('|')!==[b.cls,...b.g].join('|'))
    issue('WARNING',id,a.line,typeNames[a.cls],'NEAR_DUPLICATE',`Gần trùng với box A dòng ${b.line} (IoU ${(overlap/union).toFixed(4)}). Xem lại trên ảnh.`);
  }
  if(images.has(id))qcMetrics.matchedImages++;
  else unknownImageCount++;
 }
 const coverage=qcMetrics.coverage;
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
 return issues;
}
function assertValid(){const data=evaluateSync();const errors=data.filter(x=>x.severity==='ERROR');if(errors.length)throw Error(`QC nhãn A: ${errors.length} lỗi. ${errors[0].image_id||'manifest'} · ${errors[0].after_line?'dòng '+errors[0].after_line+': ':''}${errors[0].message} Xem mục 02 để sửa.`);}
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
async function scanQC(){
 const seq=++scanSeq;
 if(!state.after.length){issues=[];scanning=false;qcMetrics={boxes:0,validBoxes:0,pixelScanned:0,matchedImages:0,coverage:getCoverage()};unknownImageCount=0;display();return;}
 scanning=true;evaluateSync();display();
 const maps=state.after.map(file=>({key:cleanId(file.name,$('normalize').checked),file})).filter(x=>window.MatchReview?.getImageFile?.(x.key));
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,maps.length)},async()=>{
  while(cursor<maps.length){const {key,file}=maps[cursor++];try{
   const dimensions=await imageDimensions(window.MatchReview.getImageFile(key));if(seq!==scanSeq)return;
   qcMetrics.pixelScanned++;
   const height=dimensions.height,width=dimensions.width;
   for(const [idx,raw] of file.text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const p=raw.trim().split(/\s+/);if(p.length!==5||!/^[0-3]$/.test(p[0])||p.slice(1).some(v=>!floatPattern.test(v)))continue;
    const g=p.slice(1).map(Number);if(g.some(v=>!Number.isFinite(v))||g[2]<=0||g[3]<=0)continue;
    if(g[3]*height<12-1e-8)issue('WARNING',key,idx+1,typeNames[Number(p[0])],'HEIGHT_LT_12PX',`Cao ${+(g[3]*height).toFixed(2)} px (< 12 px trên ảnh ${width} × ${height}). Xem ảnh và xác nhận xử lý tại mục 02.`);
    if(g[2]*width<1-1e-8)issue('WARNING',key,idx+1,typeNames[Number(p[0])],'WIDTH_LT_1PX',`Rộng ${(g[2]*width).toFixed(2)} px (< 1 px). Cần xem lại.`);
   }
  }catch(e){if(seq===scanSeq)issue('WARNING',key,0,'','IMAGE_DECODE',`Không đọc được ảnh để kiểm tra pixel: ${e.message}`);}
 }}));
 if(seq!==scanSeq)return;scanning=false;display();
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
 void scanQC();
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
function renderFindings(){
 const filter=$('qcSeverityFilter').value;
 const findings=issues.filter(x=>filter==='all'||x.severity===filter);
 const rows=$('afterQcRows');rows.replaceChildren();const limit=150;
 for(const entry of findings.slice(0,limit)){
  const tr=document.createElement('tr');tr.className='qc'+entry.severity;
  const values=[severityTitle[entry.severity],entry.image_id||'—',entry.after_line?'A'+entry.after_line:'—',entry.class_name||'—',entry.check_code,entry.message];
  for(const [i,value] of values.entries()){const td=document.createElement('td');td.textContent=value;if(i===0)td.className='qcSeverityCell '+entry.severity;if(i===4)td.className='qcCodeCell';tr.append(td);}
  const action=document.createElement('td'),group=document.createElement('div');group.className='qcInlineActions';
  const expected=entry.after_line>0?originalLine(entry):null;
  const make=(label,handler,kind='')=>{const b=document.createElement('button');b.type='button';b.className='qcIssueAction'+(kind?' '+kind:'');b.textContent=label;b.addEventListener('click',handler);group.append(b);return b;};
  if(entry.check_code==='HEIGHT_LT_12PX')make('Xem',()=>window.QCShortBoxes?.open(entry.image_id,entry.after_line));
  if(entry.after_line>0&&qcLineCodes.has(entry.check_code)&&expected!==null){
   if(qcStructuralCodes.has(entry.check_code))make('Sửa TXT',()=>showRawEditor(entry,expected));
   else{
    let canOpen=true;try{parseLabels(nameMap(state.after).get(entry.image_id),false);}catch{canOpen=false;}
    if(canOpen)make('Chỉnh sửa',()=>void qcEdit(entry,expected),'is-edit');
    else make('Sửa TXT',()=>showRawEditor(entry,expected),'is-edit');
    if(entry.check_code==='CLAMP_TINY')make('Cắt biên',()=>qcClampTiny(entry,expected));
    if(canOpen&&['OUT_OF_BOUNDS','CENTER_OUTSIDE'].includes(entry.check_code))make('Sửa số',()=>showRawEditor(entry,expected));
   }
   make('Xóa',()=>{
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
 renderOverview();renderCoverage();renderRules();renderFindings();
}
function downloadQC(){
 if(!state.after.length){status('Chưa có nhãn A để kiểm tra.',true);return;}
 scanQC().then(()=>{
  const fields=['severity','image_id','after_line','class_name','check_code','message'];
  const data=window.YoloDiff.csv(fields,issues),url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='qc_nhan_A_sau_sua.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
}
// Đóng hộp sửa dòng bằng Escape hoặc nhấp vùng ngoài.
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('qcRawEditModal').hidden){event.preventDefault();event.stopPropagation();$('qcRawEditCancel').click();}
},true);
$('qcRawEditModal').addEventListener('click',event=>{if(event.target===$('qcRawEditModal'))$('qcRawEditCancel').click();});
$('afterQcDownload').addEventListener('click',downloadQC);
$('qcLabels').addEventListener('click',scanQC);
$('qcSeverityFilter').addEventListener('change',renderFindings);
$('normalize')?.addEventListener('change',()=>scheduleQC());
window.addEventListener('yolo:labels-updated',event=>{if(event.detail?.side==='after')scheduleQC();});
window.addEventListener('yolo:manifest-updated',()=>{refresh();scheduleQC();});
let scanTimer;
function scheduleQC(){clearTimeout(scanTimer);scanTimer=setTimeout(scanQC,120);}
window.YoloAfterQC={scan:scanQC,inspectSync:evaluateSync,assertValid,assertCoverage,download:downloadQC,getSnapshot:()=>({issues:issues.map(x=>({...x})),metrics:{...qcMetrics},scanning})};
window.YoloUploadHub={refresh,go:()=>hub.scrollIntoView({behavior:'smooth',block:'start'})};
refresh();scheduleQC();
})();
