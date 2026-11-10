// v5.0 · Xuất nhãn A hiện tại theo phân công thành viên, chặn trùng image_id.
'use strict';
(() => {
 const byId=id=>document.getElementById(id);
 const select=byId('memberExportSelect'), single=byId('memberExportOne'), batch=byId('memberExportAll'), status=byId('memberExportStatus');
 if(!select||!single||!batch||!status)return;
 const notice=(message,error=false)=>{status.textContent=message;status.classList.toggle('is-error',error);};
 const safeName=value=>/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
 function manifestInfo(){
  if(!state.manifest||!state.manifest.fields.includes('assigned_reviewer_id'))throw Error('Cần nạp assignment_manifest.csv có cột assigned_reviewer_id để xuất theo thành viên.');
  if(!state.manifest.fields.includes('image_id'))throw Error('Manifest thiếu cột image_id.');
  if(!state.manifest.rows.length)throw Error('Manifest không có ảnh được giao.');
  const byMember=new Map(), ownership=new Map(), memberPaths=new Map(), caseIds=new Map(), missingOwners=[];
  for(const [i,row] of state.manifest.rows.entries()){
   const id=cleanId(scopeId(String(row.image_id||'').trim())+'.txt',byId('normalize').checked);
   const member=String(row.assigned_reviewer_id||'').trim(),line=i+2;
   if(!id||id==='.'||id==='..'||id.includes('/')||id.includes('\\'))throw Error(`Manifest dòng ${line}: image_id không hợp lệ.`);
   if(ownership.has(id))throw Error(`Trùng image_id ${id} trong manifest (dòng ${ownership.get(id).line} và ${line}). Không xuất để tránh ghi đè nhãn.`);
   if(caseIds.has(id.toLowerCase()))throw Error(`Hai image_id chỉ khác chữ hoa/thường: ${id} và ${caseIds.get(id.toLowerCase())}. Sẽ xung đột khi ghép trên Windows.`);
   caseIds.set(id.toLowerCase(),id);
   if(!member){missingOwners.push(id);continue;}
   if(!safeName(member))throw Error(`Manifest dòng ${line}: assigned_reviewer_id phải là mã thành viên không dấu, chỉ gồm chữ, số, _ hoặc -.`);
   if(memberPaths.has(member.toLowerCase())&&memberPaths.get(member.toLowerCase())!==member)throw Error(`Mã thành viên trùng khi không phân biệt hoa/thường: ${member} và ${memberPaths.get(member.toLowerCase())}.`);
   memberPaths.set(member.toLowerCase(),member);
   ownership.set(id,{member,line});
   if(!byMember.has(member))byMember.set(member,[]);
   byMember.get(member).push(id);
  }
  if(missingOwners.length)throw Error(`Có ${missingOwners.length} ảnh chưa có assigned_reviewer_id (ví dụ ${missingOwners[0]}). Phải phân công trước để tránh nhãn không có chủ.`);
  if(!byMember.size)throw Error('Manifest chưa có phân công thành viên.');
  const sorted=[...byMember].sort((a,b)=>a[0].localeCompare(b[0],'vi',{numeric:true}));
  for(const [,ids] of sorted)ids.sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
  return {byMember:new Map(sorted),ownership};
 }
 function buildLabels(info,members,requireFull){
  if(state.busy)throw Error('Đang nạp dữ liệu, hãy hoàn tất trước khi xuất.');
  if(!state.after.length)throw Error('Chưa nạp bộ nhãn A sau sửa.');
  // nameMap detects collisions after Roboflow filename normalization.
  const loaded=nameMap(state.after),ids=[...new Set(members.flatMap(member=>info.byMember.get(member)||[]))];
  const loadedCase=new Set();
  for(const id of loaded.keys()){if(loadedCase.has(id.toLowerCase()))throw Error(`Có tên TXT A chỉ khác chữ hoa/thường (${id}.txt). Hãy sửa trước khi xuất để tránh ghi đè trên Windows.`);loadedCase.add(id.toLowerCase());}
  if(!ids.length)throw Error('Thành viên chưa có ảnh được giao.');
  const missing=ids.filter(id=>!loaded.has(id));
  if(missing.length)throw Error(`Thiếu ${missing.length} nhãn A đã phân công (ví dụ ${missing[0]}.txt). Không tự sinh TXT trống.`);
  if(requireFull){
   const extra=[...loaded.keys()].filter(id=>!info.ownership.has(id));
   if(extra.length)throw Error(`Có ${extra.length} nhãn A ngoài manifest (ví dụ ${extra[0]}.txt). Phải xử lý trước khi gộp.`);
  }
  // QC is recalculated from current live session, but errors of unrelated members
  // do not block a member-only export. Pixel warnings are advisory.
  const errors=(window.YoloAfterQC?.inspectSync?.()||[]).filter(x=>x.severity==='ERROR'&&ids.includes(x.image_id));
  if(errors.length)throw Error(`Nhãn được xuất còn ${errors.length} lỗi QC: ${errors[0].image_id} · ${errors[0].message}. Hãy sửa ở mục 02.`);
  const files=new Map(),changes=[],mapping=[];
  for(const id of ids){
   const original=loaded.get(id);
   const transformed=prepareLabelFile(original,id,byId('autoClamp').checked);
   files.set(id,transformed.file.text);changes.push(...transformed.changes);
   mapping.push({image_id:id,assigned_reviewer_id:info.ownership.get(id).member,original_path:original.path,normalized_filename:id+'.txt'});
  }
  return {files,changes,mapping};
 }
 const memberRecords=(member,info,prepared)=>{
  const ids=info.byMember.get(member);
  return [
   ...ids.map(id=>({name:`labels/${id}.txt`,data:prepared.files.get(id)})),
   {name:'calibration_ids.csv',data:csv(['image_id'],ids.map(image_id=>({image_id})))},
   {name:'filename_mapping.csv',data:csv(['image_id','assigned_reviewer_id','original_path','normalized_filename'],prepared.mapping.filter(r=>r.assigned_reviewer_id===member))},
   {name:'boundary_changes.csv',data:csv(['image_id','line_number','before','after','reason','overflow'],prepared.changes.filter(r=>info.ownership.get(r.image_id)?.member===member))}
  ];
 };
 function exportOne(){
  try{
   const info=manifestInfo(),member=select.value;
   if(!info.byMember.has(member))throw Error('Chọn đúng thành viên từ danh sách.');
   const prepared=buildLabels(info,[member],false);
   download(`labels_${member}_ready.zip`,zip(memberRecords(member,info,prepared)));
   notice(`Đã tạo ZIP ${member}: ${prepared.files.size} TXT A phiên hiện tại · ${prepared.changes.length} box cắt biên nhỏ. Không sửa nhãn trên ổ đĩa.`);
  }catch(e){notice(e.message,true);}
 }
 function exportAll(){
  try{
   const info=manifestInfo(),members=[...info.byMember.keys()],prepared=buildLabels(info,members,true),ids=[...prepared.files.keys()].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
   // Two disjoint destinations: editable hand-offs by member and a single flat merged set.
   // No file is ever overwritten. Duplicated image_id already fails in manifestInfo().
   const entries=[];
   for(const member of members)for(const entry of memberRecords(member,info,prepared))entries.push({...entry,name:`members/${member}/${entry.name}`});
   for(const id of ids)entries.push({name:`merged/labels/${id}.txt`,data:prepared.files.get(id)});
   entries.push({name:'merged/calibration_ids.csv',data:csv(['image_id'],ids.map(image_id=>({image_id})))},{name:'merge_map.csv',data:csv(['image_id','assigned_reviewer_id','original_path','normalized_filename'],prepared.mapping)},{name:'boundary_changes.csv',data:csv(['image_id','line_number','before','after','reason','overflow'],prepared.changes)},{name:'README_merge.txt',data:'YOLO Review Studio v5.0\nCác nhãn A là trạng thái mới nhất trong phiên tại thời điểm tải.\nmembers/<reviewer_id>/labels/: nhãn được giao cho từng thành viên.\nmerged/labels/: các nhãn đã gộp phẳng, không ghi đè image_id.\nmerge_map.csv ghi chủ sở hữu của từng nhãn.\nMọi xung đột tên/thiếu nhãn/lỗi QC nghiêm trọng đều chặn xuất.\nQC tự kiểm không khẳng định phương tiện đã được gán nhãn đúng.\nZIP đã tải không thể tự cập nhật; tải lại sau khi chỉnh nhãn A.\n'});
   download('labels_all_members_merge_ready.zip',zip(entries));
   notice(`Đã tạo gói ${members.length} thành viên / ${ids.length} TXT A mới nhất. Có thư mục members/ và bộ merged/labels/ đã kiểm tra trùng ID.`);
  }catch(e){notice(e.message,true);}
 }
 function render(){
  const chosen=select.value;
  select.replaceChildren();
  try{
   const info=manifestInfo();
   for(const [member,ids] of info.byMember){const option=document.createElement('option');option.value=member;option.textContent=`${member} · ${ids.length} ảnh`;select.append(option);}
   select.value=info.byMember.has(chosen)?chosen:(info.byMember.has(state.selectedMember)?state.selectedMember:[...info.byMember.keys()][0]);
   select.disabled=false;single.disabled=false;batch.disabled=false;
   status.classList.remove('is-error');
   status.textContent=`Đã phân công ${info.ownership.size} ảnh cho ${info.byMember.size} thành viên. Chọn người để tải riêng, hoặc tải gói chia nhóm kèm bộ gộp.`;
  }catch(e){
   select.replaceChildren();const option=document.createElement('option');option.textContent='Chưa có phân công hợp lệ';select.append(option);
   select.disabled=true;single.disabled=true;batch.disabled=true;
   notice(e.message,true);
  }
 }
 single.addEventListener('click',exportOne);batch.addEventListener('click',exportAll);
 window.addEventListener('yolo:manifest-updated',render);
 window.addEventListener('yolo:labels-updated',e=>{if(e.detail?.side==='after'||e.detail?.side==='demo')render();});
 byId('normalize').addEventListener('change',render);
 render();
 // Exposed only for isolated browser tests.
 window.YoloMemberReady={manifestInfo,buildLabels,exportOne,exportAll};
})();
