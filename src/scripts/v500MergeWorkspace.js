// YOLO Review Studio v5.0 — kho nhãn riêng cho mỗi thành viên, đối chiếu manifest, chuyển QC có xác nhận.
'use strict';
(() => {
 const el=id=>document.getElementById(id);
 const section=el('mergeSection');if(!section)return;
 const lock=el('mergeLock'),controls=el('mergeControls'),rows=el('mergeMemberRows'),totals=el('mergeTotals');
 const statusLine=el('mergeStatus'),foot=el('mergeFootInfo'),downloadBtn=el('mergeDownload'),qcBtn=el('mergeSendQC');
 const modal=el('mergeConfirmModal');
 const uploads=new Map(); // reviewer ID -> Map(image ID -> {name,path,text}) ; NEVER shares state.after until confirmation.
 let signature=null, currentInfo=null, snapshot=null, ingesting=false;
 const cmp=(a,b)=>a.localeCompare(b,'vi',{numeric:true});
 const safeText=x=>String(x??'');
 const warn=(s,bad=false)=>{statusLine.textContent=s;statusLine.dataset.kind=bad?'error':'info';};
 const members=()=>[...currentInfo?.byMember.keys()||[]];
 function manifest(){return window.YoloMemberReady.manifestInfo();}
 function manifestSignature(info){return [...info.byMember].flatMap(([member,ids])=>ids.map(id=>member+'\t'+id)).join('\n')+'\nnormalize='+el('normalize').checked;}
 const countUploaded=()=>[...uploads.values()].reduce((n,m)=>n+m.size,0);
 function validateFormat(entry,id){
  if(entry.text.length>2*1024*1024)throw Error(`${id}.txt lớn hơn 2 MB.`);
  try{
   const boxes=parseLabels(entry,false);
   for(const b of boxes){const [x,y,w,h]=b.g;
    if(![x,y,w,h].every(Number.isFinite)||Math.max(0,-x+w/2,-y+h/2,x+w/2-1,y+h/2-1)>1e-5)
     throw Error(`${id}.txt dòng ${b.line}: box vượt biên rõ rệt, cần sửa trước khi gộp.`);
   }
  }catch(e){throw Error(`Nhãn ${id}.txt không đạt kiểm tra cấu trúc: ${e.message}`);}
 }
 async function readZip(source){
  if(source.size>250*1024*1024)throw Error(`${source.name}: ZIP quá 250 MB. Hãy nạp thư mục nhãn để giảm tải.`);
  if(typeof JSZip==='undefined')throw Error('Thiếu thư viện đọc ZIP; vui lòng mở index.html của bản đầy đủ.');
  const arch=await JSZip.loadAsync(await source.arrayBuffer());
  const all=Object.values(arch.files).filter(e=>!e.dir&&!/(?:^|\/)(?:__MACOSX|\._[^/]+)(?:\/|$)/i.test(e.name));
  if(all.length>20000)throw Error(`${source.name}: quá 20.000 tệp trong ZIP.`);
  if(all.some(e=>/^(?:merged\/|members\/)/i.test(e.name)))throw Error('Hãy nạp ZIP riêng của một thành viên, không nạp lại gói ZIP toàn nhóm hoặc bộ đã gộp.');
  let list=all.filter(e=>/\.txt$/i.test(e.name)&&!/(?:^|\/)(?:README[^/]*|classes)\.txt$/i.test(e.name));
  const labels=list.filter(e=>/(?:^|\/)(?:labels|reference_labels)\//i.test(e.name));if(labels.length)list=labels;
  if(!list.length)throw Error(`${source.name}: không tìm thấy TXT trong thư mục labels.`);
  let bytes=0;const output=[];const decoder=new TextDecoder('utf-8',{fatal:true});
  for(const item of list){
   const data=await item.async('uint8array');bytes+=data.byteLength;
   if(data.byteLength>2*1024*1024||bytes>100*1024*1024)throw Error(`${source.name}: dung lượng nhãn quá lớn.`);
   output.push({name:item.name.split('/').pop(),path:source.name+'/'+item.name,text:decoder.decode(data)});
  }
  return output;
 }
 async function readFolder(list){
  let bytes=0;const output=[];
  for(const file of list){
   if(!/\.txt$/i.test(file.name)||/^(?:README[^/]*|classes)\.txt$/i.test(file.name))continue;
   bytes+=file.size;if(file.size>2*1024*1024||bytes>100*1024*1024)throw Error('Thư mục quá lớn; nhãn phải dưới 2 MB/tệp và 100 MB tổng.');
   output.push({name:file.name,path:file.webkitRelativePath||file.name,text:await file.text()});
  }
  if(!output.length)throw Error('Không thấy TXT nhãn hợp lệ trong thư mục đã chọn.');
  return output;
 }
 function detectOwner(sourceName,records,info){
  const explicit=members().filter(member=>{
   const escaped=member.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const pattern=new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`,'i');
   return pattern.test(sourceName)||records.some(f=>pattern.test(f.path));
  });
  if(explicit.length>1)throw Error(`Tên thư mục/ZIP có nhiều mã thành viên: ${explicit.join(', ')}.`);
  const assigned=new Set(records.map(f=>info.ownership.get(cleanId(f.name,el('normalize').checked))?.member).filter(Boolean));
  if(!assigned.size)throw Error('Không có image_id nào trong manifest khớp bộ nhãn vừa nạp.');
  if(assigned.size>1)throw Error(`Một lượt nạp chứa nhãn thuộc nhiều thành viên (${[...assigned].join(', ')}). Hãy tách từng người.`);
  const member=explicit[0]||[...assigned][0];
  if(member!==[...assigned][0])throw Error(`Tên thư mục ghi ${member}, nhưng nhãn thuộc ${[...assigned][0]} theo assignment_manifest.csv.`);
  return member;
 }
 function classify(records,sourceName,info){
  const mapped=new Map(),nameCase=new Map();
  for(const f of records){
   const id=cleanId(f.name,el('normalize').checked);
   if(!id||id==='.'||id==='..'||!info.ownership.has(id))throw Error(`${sourceName}: TXT ${f.name} không được phân công trong manifest (hoặc tên chưa chuẩn hóa đúng).`);
   const key=id.toLowerCase();
   if(nameCase.has(key))throw Error(`${sourceName}: trùng TXT/image_id ${id}. Không ghi đè âm thầm.`);
   nameCase.set(key,id);validateFormat(f,id);
   mapped.set(id,{...f,name:id+'.txt'});
  }
  const member=detectOwner(sourceName,records,info);
  for(const id of mapped.keys())if(info.ownership.get(id).member!==member)throw Error(`TXT ${id} không thuộc thành viên ${member}.`);
  return {member,files:mapped};
 }
 async function ingestSources(list,folderMode=false){
  if(ingesting)return;
  if(!currentInfo){warn('Chưa có assignment_manifest.csv hợp lệ; không thể nạp.',true);return;}
  const sources=folderMode?[{name:list[0]?.webkitRelativePath?.split('/')[0]||'Thư mục nhãn', files:list}]:list.map(f=>({name:f.name,zip:f}));
  if(!sources.length)return;
  ingesting=true;render();warn(`Đang đọc ${sources.length} bộ nhãn…`);
  try{
   const pending=new Map();
   for(const src of sources){
    const labels=src.zip?await readZip(src.zip):await readFolder(src.files);
    const batch=classify(labels,src.name,currentInfo);
    if(pending.has(batch.member))throw Error(`Một lần nạp chứa hai bộ ${batch.member}. Nạp lần lượt để tránh ghi đè.`);
    pending.set(batch.member,batch.files);
   }
   for(const [member,files] of pending){
    if(uploads.has(member)&&!window.confirm(`Đã có ${uploads.get(member).size} TXT của ${member}. Bạn muốn thay toàn bộ bằng ${files.size} TXT mới?\n\nKhông tự trộn hai phiên bản nhãn của cùng người.`)){
     warn(`Đã hủy thay thế ${member}. Các nhãn đã nạp vẫn được giữ.`);return;
    }
   }
   for(const [member,files] of pending)uploads.set(member,files);
   warn(`Đã nạp ${[...pending].map(([m,files])=>`${m}: ${files.size} TXT`).join(' · ')}. Nhãn A ở mục 02 chưa thay đổi.`);
  }catch(e){warn('Không nạp dữ liệu: '+e.message,true);}
  finally{ingesting=false;render();}
 }
 // Role-confirmed upload from section 01: supports one G11 folder with manifest and 1–10 reviewer subfolders.
 // Review ownership is verified from image_id, never guessed solely from the folder name.
 async function ingestExpandedGroups(groups){
  try{
   const info=manifest();
   const staged=new Map(),globalIds=new Set();let total=0;
   const memberList=[...info.byMember.keys()];
   for(const group of groups){
    for(const f of group.files){
     const path=String(f._hubPath||f.webkitRelativePath||f.name).replace(/\\/g,'/');
     const id=cleanId(f.name,el('normalize').checked),owner=info.ownership.get(id);
     if(!owner)throw Error(`Nhãn ${path} không có image_id trong assignment_manifest.csv.`);
     if(globalIds.has(id.toLowerCase()))throw Error(`Trùng image_id trong các thư mục vừa chọn: ${id}.`);
     globalIds.add(id.toLowerCase());
     const explicit=memberList.filter(m=>{
      const esc=m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`,'i').test(path);
     });
     if(explicit.length>1)throw Error(`Nhãn ${path} chứa nhiều mã thành viên trong đường dẫn.`);
     if(explicit.length&&explicit[0]!==owner.member)throw Error(`Sai thành viên: ${path} nằm trong ${explicit[0]} nhưng manifest giao cho ${owner.member}.`);
     const entry={name:id+'.txt',path,text:await f.text()};
     validateFormat(entry,id);
     if(!staged.has(owner.member))staged.set(owner.member,new Map());
     staged.get(owner.member).set(id,entry);total++;
    }
   }
   if(!total)throw Error('Không tìm thấy TXT nhãn thành viên trong nhóm được chọn.');
   const replacing=[...staged.keys()].filter(m=>uploads.has(m));
   if(replacing.length&&!window.confirm(`Thay toàn bộ nhãn đã nạp của ${replacing.join(', ')} bằng bộ vừa chọn?\n\nNhãn A/B không bị thay đổi.`))
    return {ok:false,message:'Đã hủy thay thế nhãn thành viên; dữ liệu trước đó được giữ nguyên.'};
   for(const [m,files] of staged)uploads.set(m,files);
   warn(`Đã nạp ${total} nhãn của ${staged.size} thành viên. Các nhãn được lưu riêng tại mục 06, không thay đổi A/B.`);
   render();
   return {ok:true,message:`Nhãn thành viên: ${total} TXT / ${staged.size} người; có thể tiếp tục thao tác ở mục hiện tại`};
  }catch(e){warn('Không nạp nhãn thành viên: '+e.message,true);render();return {ok:false,message:e.message};}
 }
 function getSnapshot(){
  if(!currentInfo)return {ready:false,missing:[],total:0,received:0,all:new Map()};
  const all=new Map(),missing=[];
  for(const [member,ids] of currentInfo.byMember){
   const have=uploads.get(member)||new Map();
   for(const id of ids){const f=have.get(id);if(f){if(all.has(id))throw Error(`Trùng ${id} trong hai bộ nhãn.`);all.set(id,f);}else missing.push({member,id});}
  }
  return {ready:!missing.length&&!ingesting&&all.size>0,missing,total:currentInfo.ownership.size,received:all.size,all};
 }
 function render(){
  let info=null,reason='';
  try{info=manifest();}catch(e){reason=e.message;}
  const newSig=info?manifestSignature(info):null;
  if(signature!==newSig){
   const oldCount=countUploaded();uploads.clear();
   if(oldCount&&newSig!==signature)warn('Manifest hoặc quy tắc chuẩn hóa tên đã thay đổi. Đã xóa dữ liệu mục 06 để tránh gộp sai phân công.',true);
   signature=newSig;
  }
  currentInfo=info;const locked=!info;
  lock.hidden=!locked;controls.disabled=locked||ingesting;section.classList.toggle('is-locked',locked);
  if(locked){lock.querySelector('span').textContent=reason+' Nạp assignment_manifest.csv tại mục 01 để mở khóa.';rows.replaceChildren();totals.replaceChildren();downloadBtn.disabled=true;qcBtn.disabled=true;el('mergeClearAll').disabled=true;foot.textContent='Đang khóa vì thiếu manifest hợp lệ.';snapshot=null;return;}
  snapshot=getSnapshot();rows.replaceChildren();totals.replaceChildren();
  const present=members().filter(m=>uploads.has(m)).length;
  for(const [n,label] of [[`${snapshot.received}/${snapshot.total}`,'Nhãn đã có'],[String(snapshot.missing.length),'Nhãn còn thiếu'],[`${present}/${currentInfo.byMember.size}`,'Thành viên đã nạp']]){
   const block=document.createElement('div');block.className='mergeMetric';const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=n;span.textContent=label;block.append(strong,span);totals.append(block);
  }
  for(const [member,assigned] of currentInfo.byMember){
   const m=uploads.get(member)||new Map(),found=assigned.filter(id=>m.has(id)).length,missing=assigned.length-found,pct=assigned.length?100*found/assigned.length:100;
   const box=document.createElement('div');box.className='mergeMemberCard'+(!missing?' is-complete':found?' is-partial':' is-empty');box.setAttribute('role','listitem');
   const top=document.createElement('div');top.className='mergeMemberTop';
   const name=document.createElement('strong');name.textContent=member;
   const stateBadge=document.createElement('span');stateBadge.className='mergeMemberState';stateBadge.textContent=!missing?'Đã đủ nhãn':found?'Đang bổ sung':'Chưa nạp';
   top.append(name,stateBadge);
   const stats=document.createElement('div');stats.className='mergeMemberStats';
   const count=document.createElement('strong');count.textContent=`${found} / ${assigned.length}`;
   const caption=document.createElement('span');caption.textContent='tệp TXT đã nạp';
   const percent=document.createElement('span');percent.className='mergeMemberPercent';percent.textContent=Math.round(pct)+'%';
   stats.append(count,caption,percent);
   const track=document.createElement('div');track.className='mergeTrack';track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(assigned.length));track.setAttribute('aria-valuenow',String(found));track.setAttribute('aria-label',`Tiến độ nhãn ${member}`);
   const fill=document.createElement('div');fill.className='mergeTrackFill';fill.style.width=pct.toFixed(2)+'%';track.append(fill);
   const bottom=document.createElement('div');bottom.className='mergeMemberBottom';
   const note=document.createElement('span');note.className='mergeMemberSummary';note.textContent=missing?`Cần bổ sung ${missing} tệp TXT còn thiếu`:`Đã nạp đầy đủ nhãn theo manifest`;
   bottom.append(note);
   if(m.size){
    const btn=document.createElement('button');btn.type='button';btn.className='mergeRemoveMember';btn.textContent='Xóa bộ nhãn';btn.disabled=ingesting;btn.setAttribute('aria-label',`Xóa ${m.size} nhãn đã nạp của ${member}`);
    btn.addEventListener('click',()=>{if(window.confirm(`Xóa ${m.size} nhãn đã nạp của ${member} trong mục 06? Nhãn A ở mục 02 không bị ảnh hưởng.`)){uploads.delete(member);warn(`Đã xóa dữ liệu của ${member} trong mục 06.`);render();}});
    bottom.append(btn);
   }
   box.append(top,stats,track,bottom);
   if(missing){
    // Keep hashes out of the default layout; reveal full, selectable filenames on demand.
    const details=document.createElement('details');details.className='mergeMissingDetails';
    const summary=document.createElement('summary');summary.textContent=`Xem ${missing} tệp còn thiếu`;
    const missingList=document.createElement('div');missingList.className='mergeMissingList';
    for(const id of assigned){if(m.has(id))continue;const item=document.createElement('div');item.textContent=id+'.txt';missingList.append(item);}
    details.append(summary,missingList);box.append(details);
   }
   rows.append(box);
  }
  const done=snapshot.ready;
  downloadBtn.disabled=!done;qcBtn.disabled=!done;el('mergeClearAll').disabled=!uploads.size;
  foot.textContent=done?`Đã đủ ${snapshot.total} nhãn của ${currentInfo.byMember.size} thành viên. Có thể tải ZIP gộp hoặc chuyển sang QC.`:`Chưa thể tải: còn thiếu ${snapshot.missing.length} nhãn. Bộ đã nạp tại đây chưa ảnh hưởng nhãn A đang kiểm tra.`;
 }
 function buildRecords(){
  const data=getSnapshot();if(!data.ready)throw Error('Phải nạp đầy đủ nhãn theo manifest trước khi xuất/chuyển sang QC.');
  const list=[...data.all].sort((a,b)=>cmp(a[0],b[0]));
  for(const [id,f] of list)validateFormat(f,id);
  return list;
 }
 function exportMerged(){
  try{
   const list=buildRecords();const files=list.map(([id,f])=>({name:'labels/'+id+'.txt',data:f.text}));
   files.push({name:'assignment_manifest.csv',data:csv(state.manifest.fields,state.manifest.rows)},
    {name:'merge_map.csv',data:csv(['image_id','assigned_reviewer_id','source_path','normalized_filename'],list.map(([id,f])=>({image_id:id,assigned_reviewer_id:currentInfo.ownership.get(id).member,source_path:f.path,normalized_filename:id+'.txt'})))},
    {name:'README_merge.txt',data:`YOLO Review Studio v5.0\n${list.length} nhãn A gộp từ ${uploads.size} thành viên.\nlabels/ chứa TXT đã chuẩn hóa image_id.\nassignment_manifest.csv là phân công kiểm tra.\nmerge_map.csv ghi nguồn tệp của từng nhãn.\nQC kỹ thuật không xác nhận nội dung ảnh đúng. Hãy bấm Rà soát QC trước khi nộp.\nZIP là ảnh chụp dữ liệu tại thời điểm tải.\n`});
   download('YOLO_v5.0_merged_labels_ready.zip',zip(files));
   warn(`Đã tạo ZIP gộp ${list.length} nhãn, ${uploads.size} thành viên. Không ghi đè file trên máy.`);
  }catch(e){warn(e.message,true);}
 }
 function commitQC(){
  try{
   const list=buildRecords();
   state.after=list.map(([id,f])=>({...f,name:id+'.txt',path:f.path}));
   state.matchReviews.clear();state.manifestScope='all';state.selectedMember='';
   if(typeof renderManifestMembers==='function')renderManifestMembers();
   invalidate();updateCounts();
   window.dispatchEvent(new CustomEvent('yolo:labels-updated',{detail:{side:'after',source:'merge-v500'}}));
   modal.hidden=true;
   el('prepSection').scrollIntoView({behavior:'smooth',block:'start'});
   warn(`Đã chuyển ${list.length} nhãn đã gộp vào A để QC. Nhãn B và dữ liệu mục 06 vẫn giữ nguyên. Sau khi chỉnh sửa ở mục 02/05, tải calibration_ready.zip tại mục 02; ZIP riêng trong mục 06 không tự nhận các thay đổi này.`);
   void window.YoloAfterQC?.scan?.({manual:true});
  }catch(e){modal.hidden=true;warn('Không chuyển được vào QC: '+e.message,true);}
 }
 function requestQC(){
  try{
   const list=buildRecords();
   if(!state.after.length){commitQC();return;}
   el('mergeConfirmText').textContent=`Bạn sẽ xóa toàn bộ ${state.after.length} tệp nhãn A trước đó trong phiên để tiến hành kiểm định ${list.length} tệp nhãn gộp này tại mục 02. Không thể hoàn tác nếu chưa tải nhãn A cũ về máy. Nhãn B, ảnh gốc và kho mục 06 không bị xóa.`;
   modal.hidden=false;el('mergeConfirmCancel').focus();
  }catch(e){warn(e.message,true);}
 }

 // Unified hub picker: recognize separately assigned member archives/folders; preserve ordinary Gxx and Roboflow uploads.
 async function routeHubInput(files,folderMode=false){
  if(!files?.length)return {handled:false,remaining:files||[]};
  // A ZIP named for a reviewer is a member package. Other ZIPs go through normal B/A confirmation.
  const reviewerTag=/(?:^|[^a-z0-9])g\d+[_-]?sv\d+(?=$|[^a-z0-9])/i;
  const labelZipName=/^(?:labels?|nhan)[_-].*\.zip$/i;
  const zips=files.filter(f=>/\.zip$/i.test(f.name));
  const markedZip=zips.filter(f=>reviewerTag.test(f.name)||labelZipName.test(f.name));
  const remaining=files.filter(f=>!markedZip.includes(f));
  const relative=files.map(f=>String(f.webkitRelativePath||f._yoloPath||''));
  const directoryInput=folderMode||relative.some(p=>p.includes('/'));
  let memberFolder=false;
  if(directoryInput&&!zips.length){
   const roots=new Set(relative.filter(Boolean).map(p=>p.split('/')[0]));
   const sourceName=[...roots].join(' ');
   const txt=files.filter(f=>/\.txt$/i.test(f.name)&&!/^(?:README[^/]*|classes)\.txt$/i.test(f.name));
   const hasData=files.some(f=>/\.(?:png|jpe?g|webp|bmp|gif|avif|yaml|yml)$/i.test(f.name));
   const everyLabel=txt.length>0&&!hasData;
   const plausibleMember=Boolean(reviewerTag.test(sourceName)||relative.some(p=>p.split('/').some(part=>reviewerTag.test(part))));
   const assigned=everyLabel&&currentInfo?new Set(txt.map(f=>currentInfo.ownership.get(cleanId(f.name,el('normalize').checked))?.member).filter(Boolean)):new Set();
   memberFolder=everyLabel&&(plausibleMember||assigned.size===1);
   // Named reviewer folder containing invalid contents must still be blocked from the ordinary A/B upload.
   if(plausibleMember)memberFolder=true;
  }
  const recognized=markedZip.length||memberFolder;
  if(!recognized)return {handled:false,remaining:files};
  if(!currentInfo){
   warn('Cần nạp assignment_manifest.csv hợp lệ tại mục 01 TRƯỚC khi nạp nhãn thành viên.',true);
   return {handled:true,remaining:memberFolder?[]:remaining,summary:'Chưa nạp nhãn thành viên: thiếu assignment_manifest.csv.',error:true};
  }
  if(memberFolder){
   await ingestSources(files,true);
   return {handled:true,remaining:[],summary:'Đã chuyển thư mục nhãn thành viên sang mục 06. Xem tiến độ và thông báo tại đó.'};
  }
  await ingestSources(markedZip,false);
  return {handled:true,remaining,summary:`Đã phân loại ${markedZip.length} ZIP nhãn thành viên vào mục 06; nhãn A/B không tự thay đổi.`};
 }

 downloadBtn.addEventListener('click',exportMerged);qcBtn.addEventListener('click',requestQC);
 el('mergeGoManifest').addEventListener('click',()=>el('uploadHub').scrollIntoView({behavior:'smooth',block:'start'}));
 el('mergeClearAll').addEventListener('click',()=>{if(!uploads.size||!window.confirm(`Xóa ${countUploaded()} nhãn ở mục 06 của ${uploads.size} thành viên? Nhãn A mục 02 được giữ nguyên.`))return;uploads.clear();warn('Đã xóa toàn bộ dữ liệu chỉ trong mục 06.');render();});
 el('mergeConfirmCancel').addEventListener('click',()=>modal.hidden=true);
 el('mergeConfirmAccept').addEventListener('click',commitQC);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)modal.hidden=true;});
 window.addEventListener('yolo:manifest-updated',render);
 el('normalize').addEventListener('change',render);
 render();
 window.YoloMerge={getSnapshot,ingestSources,ingestExpandedGroups,routeHubInput,exportMerged,commitQC,render,getMembers:()=>new Map(uploads)};
})();
