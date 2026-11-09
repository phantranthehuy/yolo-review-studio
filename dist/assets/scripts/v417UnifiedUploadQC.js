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
function note(id,text,missing){const el=$(id);if(!el)return;el.replaceChildren();const t=document.createElement('span');t.textContent=text;el.append(t);if(missing){const b=document.createElement('button');b.type='button';b.dataset.hubGo='1';b.textContent='Đến ô nạp dữ liệu';el.append(b);}}
function refresh(){
 const ready=[['before','Nhãn B'],['after','Nhãn A'],['images','Ảnh gốc'],['gold','Nhãn tham chiếu']];$('hubLoaded').replaceChildren();
 for(const [key,label] of ready){const qty=isLoaded(key),box=document.createElement('div');box.className='hubLoadedItem '+(qty?'hubReady':'hubMissing');const name=document.createElement('strong');name.textContent=label;const count=document.createElement('span');count.textContent=qty?`${qty} ${key==='images'?'ảnh':'tệp'}`:'Chưa nạp';box.append(name,count);$('hubLoaded').append(box);}
 $('hubExportBefore').disabled=!state.before.length;$('hubExportAfter').disabled=!state.after.length;
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
// Standalone format QC: always read original edited labels A, not the old B labels.
const floatPattern=/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const typeNames=['2-wheel vehicles','bus','car','truck'];
let issues=[],scanSeq=0,scanning=false,unknownImageCount=0;
const dimensionCache=new WeakMap();
function issue(severity,key,line,clazz,code,description){issues.push({severity,image_id:key,after_line:line,class_name:clazz,check_code:code,message:description});}
function evaluateSync(){
 issues=[];unknownImageCount=0;
 const seenNames=new Map(),images=new Set(getImages());
 for(const file of state.after){
  const id=cleanId(file.name,$('normalize').checked);
  if(seenNames.has(id))issue('ERROR',id,0,'','DUPLICATE_IMAGE_ID',`Trùng ID chuẩn hóa giữa ${seenNames.get(id)} và ${file.name}.`);
  else seenNames.set(id,file.name);
  if(!id||id==='.'||id==='..')issue('ERROR',id,0,'','BAD_IMAGE_ID','ID ảnh rỗng/không hợp lệ.');
  const seenExact=new Map(),boxes=[],lines=file.text.replace(/^\uFEFF/,'').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const raw=lines[i].trim();if(!raw)continue;
   const p=raw.split(/\s+/),line=i+1;
   if(p.length!==5){issue('ERROR',id,line,'','COLUMN_COUNT',`Cần đúng 5 cột class x_center y_center width height; hiện có ${p.length}.`);continue;}
   const cls=Number(p[0]),name=/^[0-3]$/.test(p[0])?typeNames[cls]:'';
   if(!/^[0-3]$/.test(p[0])){issue('ERROR',id,line,'','CLASS_ID','class_id phải là số nguyên 0, 1, 2 hoặc 3.');continue;}
   if(p.slice(1).some(n=>!floatPattern.test(n))){issue('ERROR',id,line,name,'INVALID_NUMBER','Giá trị tọa độ không phải số YOLO hợp lệ (không nhận NaN, Infinity, dấu phẩy hoặc ký tự lạ).');continue;}
   const g=p.slice(1).map(Number);if(g.some(n=>!Number.isFinite(n))){issue('ERROR',id,line,name,'NONFINITE','Tọa độ vượt miền số hữu hạn.');continue;}
   const [x,y,w,h]=g;
   if(w<=0||h<=0){issue('ERROR',id,line,name,'NONPOSITIVE_SIZE','Chiều rộng và chiều cao phải lớn hơn 0.');continue;}
   if(x<0||x>1||y<0||y>1)issue('ERROR',id,line,name,'CENTER_OUTSIDE','Tâm box nằm ngoài miền [0,1].');
   const left=x-w/2,top=y-h/2,right=x+w/2,bottom=y+h/2;
   const exceed=Math.max(0,-left,-top,right-1,bottom-1);
   if(exceed>1e-5+1e-12)issue('ERROR',id,line,name,'OUT_OF_BOUNDS',`Box vượt cạnh ảnh ${exceed.toPrecision(4)} (tọa độ chuẩn hóa). Phải sửa, không tự cắt biên lớn.`);
   else if(exceed>1e-12)issue('WARNING',id,line,name,'CLAMP_TINY',`Box vượt biên rất nhỏ ${exceed.toExponential(2)}; chỉ được cắt khi bật tùy chọn cắt biên.`);
   const exact=[cls,...g].join('|');
   if(seenExact.has(exact))issue('ERROR',id,line,name,'DUPLICATE_EXACT',`Trùng hoàn toàn với box A dòng ${seenExact.get(exact)}.`);
   else seenExact.set(exact,line);
   boxes.push({line,cls,g,w,h,left,top,right,bottom});
  }
  if(!boxes.length&&!lines.some(v=>v.trim()))issue('INFO',id,0,'','EMPTY_LABEL','TXT trống; cần xác nhận đây là ảnh không có phương tiện.');
  for(let i=0;i<boxes.length;i++){
   for(let j=0;j<i;j++){
    const a=boxes[i],b=boxes[j];if(a.cls!==b.cls)continue;
    const ix=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),iy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const overlap=ix*iy,union=a.w*a.h+b.w*b.h-overlap;
    if(overlap>0&&union>0&&overlap/union>=.995&&[a.cls,...a.g].join('|')!==[b.cls,...b.g].join('|'))
     issue('WARNING',id,a.line,typeNames[a.cls],'NEAR_DUPLICATE',`Gần trùng box A dòng ${b.line} (IoU ${(overlap/union).toFixed(4)}). Kiểm tra có cùng xe không.`);
   }
  }
  if(!images.has(id))unknownImageCount++;
 }
 return issues;
}
function assertValid(){const data=evaluateSync(),first=data.find(x=>x.severity==='ERROR');if(first){throw Error(`QC nhãn A: ${data.filter(x=>x.severity==='ERROR').length} lỗi. ${first.image_id} · A${first.after_line}: ${first.message} Xem bảng QC mục 02 rồi sửa nhãn.`);}}
function imageDimensions(file){if(dimensionCache.has(file))return dimensionCache.get(file);
 const promise=(async()=>{if(typeof createImageBitmap==='function'){
   const bitmap=await createImageBitmap(file);const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;
  }
  return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight});};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Không đọc được kích thước ảnh.'));};img.src=url;});
 })();dimensionCache.set(file,promise);return promise;
}
async function scanQC(){const seq=++scanSeq;if(!state.after.length){issues=[];display();return;}
 scanning=true;evaluateSync();display();
 const maps=state.after.map(f=>({key:cleanId(f.name,$('normalize').checked),file:f})).filter(x=>window.MatchReview?.getImageFile?.(x.key));
 let cursor=0;await Promise.all(Array.from({length:Math.min(3,maps.length)},async()=>{
 while(cursor<maps.length){const {key,file}=maps[cursor++];try{
  const dimensions=await imageDimensions(window.MatchReview.getImageFile(key));if(seq!==scanSeq)return;
  const height=dimensions.height,width=dimensions.width;
  for(const [idx,raw] of file.text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
   const p=raw.trim().split(/\s+/);if(p.length!==5||!/^[0-3]$/.test(p[0])||p.slice(1).some(v=>!floatPattern.test(v)))continue;
   const g=p.slice(1).map(Number);if(g.some(v=>!Number.isFinite(v))||g[2]<=0||g[3]<=0)continue;
   if(g[3]*height<12-1e-8)issue('WARNING',key,idx+1,typeNames[Number(p[0])],'HEIGHT_LT_12PX',`Chiều cao ${+(g[3]*height).toFixed(2)} px, nhỏ hơn 12 px (ảnh gốc ${width} × ${height}). Có thể chọn xóa ở mục 04 sau khi xác nhận.`);
   if(g[2]*width<1-1e-8)issue('WARNING',key,idx+1,typeNames[Number(p[0])],'WIDTH_LT_1PX',`Chiều rộng ${(g[2]*width).toFixed(2)} px, nhỏ hơn 1 px; kiểm tra lại.`);
  }
 }catch(e){if(seq===scanSeq)issue('WARNING',key,0,'','IMAGE_DECODE',`Không đọc được ảnh để kiểm tra pixel: ${e.message}`);}
 }}));
 if(seq!==scanSeq)return;scanning=false;display();
}
function display(){
 const status=$('afterQcStatus'),download=$('afterQcDownload');download.disabled=!state.after.length;
 if(!state.after.length){status.textContent='Chưa nạp nhãn sau sửa A. Thả thư mục nhãn A vào ô nạp chung mục 01.';$('afterQcTableWrap').hidden=true;return;}
 const n=label=>issues.filter(x=>x.severity===label).length;
 status.textContent=`${state.after.length} tệp nhãn A · ${n('ERROR')} lỗi · ${n('WARNING')} cảnh báo · ${n('INFO')} thông tin${unknownImageCount?' · '+unknownImageCount+' ảnh chưa nạp nên chưa đánh giá được chiều cao pixel':''}.${scanning?' Đang kiểm tra kích thước ảnh…':''}`;
 status.className=n('ERROR')?'qcBad':n('WARNING')?'qcWarn':'qcGood';
 const rows=$('afterQcRows');rows.replaceChildren();const limit=180;
 for(const issue of issues.slice(0,limit)){
  const tr=document.createElement('tr');tr.className='qc'+issue.severity;
  for(const value of [issue.severity,issue.image_id,issue.after_line?'A'+issue.after_line:'—',issue.class_name||'—',issue.message]){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);
 }
 $('afterQcMore').textContent=issues.length>limit?`Đang hiển thị ${limit}/${issues.length} vấn đề. Tải CSV để xem đầy đủ.`:'';
 $('afterQcTableWrap').hidden=!issues.length;
}
function downloadQC(){if(!state.after.length){status('Chưa có nhãn sau sửa A để kiểm tra.',true);return;}
 // Always rescan structural QC to ensure a stale result isn't exported after labels are edited.
 scanQC().then(()=>{
  const fields=['severity','image_id','after_line','class_name','check_code','message'],data=window.YoloDiff.csv(fields,issues);
  const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='qc_nhan_A_sau_sua.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
}
$('afterQcDownload').addEventListener('click',downloadQC);
$('qcLabels').onclick=downloadQC;
let scanTimer;
function scheduleQC(){clearTimeout(scanTimer);scanTimer=setTimeout(scanQC,120);}
window.YoloAfterQC={scan:scanQC,inspectSync:evaluateSync,assertValid,download:downloadQC};
window.YoloUploadHub={refresh,go:()=>hub.scrollIntoView({behavior:'smooth',block:'start'})};
refresh();scheduleQC();
})();
