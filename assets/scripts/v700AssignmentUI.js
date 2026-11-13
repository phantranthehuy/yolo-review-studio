/* 07 · Chia việc. No backend and no mutation of the original files. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),section=$('allocationSection');if(!section)return;
 const engine=window.YoloAssignmentEngine;if(!engine){$('allocNotice').textContent='Thiếu file thuật toán mục 07.';return;}
 const ui={official:null,log:null,sessionManifest:null,selected:new Set(),locked:new Set(),loadedSignature:'',plan:null,files:null,applied:false};
 const s=x=>String(x??''),sort=(a,b)=>a.localeCompare(b,'en');
 function notice(message,error=false){$('allocNotice').textContent=message;$('allocNotice').dataset.kind=error?'error':'info';$('allocNotice').hidden=!message;}
 function cell(tr,text,tag='td'){const c=document.createElement(tag);c.textContent=s(text);tr.append(c);return c;}
 function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=s(text);if(cls)e.className=cls;return e;}
 function kpi(host,value,label){const d=node('div',null,'allocKpi');d.append(node('b',value),node('span',label));host.append(d);}
 function sourceManifest(){return ui.sessionManifest||state.manifest;}
 function manifest(){return engine.manifestInput(sourceManifest());}
 function sourceOfficial(){return ui.official;}
 function clearResult(){ui.plan=null;ui.files=null;$('allocResults').hidden=true;$('allocPreviewStatus').textContent='Đã thay đổi cấu hình · tính lại trước khi xuất';for(const id of ['allocZip','allocExportChoice','allocExportSingle','allocSessionSave','allocApply'])$(id).disabled=true;}
 function collect(){return {
  manifest:sourceManifest(),active:[...ui.selected].sort(sort),official:sourceOfficial(),reviewLog:ui.log?.rows||null,
  reviewMode:document.querySelector('input[name="allocReviewMode"]:checked')?.value||'preserve',checkerMode:$('allocCheckerMode').value,
  direction:Number($('allocRingDirection').value),seed:Number($('allocSeed').value),targetedCount:Number($('allocTargeted').value),
  allowCompletedTransfer:$('allocAllowCompleted').checked,lockedMembers:[...ui.locked]
 };}
 function renderSources(){
  const host=$('allocManifestOverview');host.replaceChildren();
  try{const data=manifest();
   $('allocLock').hidden=true;$('allocControls').hidden=false;$('allocControls').disabled=false;$('allocControls').removeAttribute('aria-hidden');section.classList.remove('is-locked');
   $('allocManifestSource').textContent=`Nguồn: ${state.fileOrigins.manifest||'Manifest phiên được khôi phục'} · ${data.rows.length.toLocaleString('vi-VN')} ảnh · ${data.owners.length} thành viên`;
   kpi(host,data.rows.length,'Tổng ảnh từ manifest');kpi(host,data.owners.length,'Mã thành viên gốc');kpi(host,data.group,'Mã nhóm');
   const src=sourceOfficial();kpi(host,src?.rows?.length||'—',src?'Mẫu kiểm chéo đã có':'Chưa có mẫu kiểm chéo gốc');
   $('allocOfficialName').textContent=ui.official?`${ui.official.fileName} · ${ui.official.rows.length} ảnh`:'Chưa có mẫu chính thức — nếu tạo mới, ghi rõ nguồn.';
   $('allocLogName').textContent=ui.log?`${ui.log.fileName} · ${ui.log.rows.length} dòng`:'Tùy chọn — dùng trạng thái manifest nếu có.';
  }catch(e){
   $('allocLock').hidden=false;$('allocControls').hidden=true;$('allocControls').disabled=true;$('allocControls').setAttribute('aria-hidden','true');section.classList.add('is-locked');
   $('allocLockMessage').textContent=e.message.includes('Cần assignment_manifest.csv')?'Cần manifest có cột image_id và assigned_reviewer_id để xác định chính xác ảnh và người review. Nạp manifest tại mục 01 để mở khóa.':e.message+' Nạp manifest hợp lệ tại mục 01 để mở khóa.';
   $('allocManifestSource').textContent='Chưa có manifest của cả nhóm. Nạp assignment_manifest.csv tại mục 01.';
   kpi(host,'—','Chưa có manifest được xác thực');$('allocOfficialName').textContent=ui.official?.fileName||'Chưa có mẫu';
   $('allocCompletedWarning').hidden=true;$('allocAllowCompleted').checked=false;
  }
 }
 function renderCompletedWarning(){
  const box=$('allocCompletedWarning'),check=$('allocAllowCompleted');
  try{const x=engine.completedTransferInfo({manifest:sourceManifest(),active:[...ui.selected],reviewLog:ui.log?.rows||null});
   box.hidden=x.count===0;
   if(x.count){$('allocCompletedTitle').textContent=`${x.count} ảnh đã hoàn tất thuộc thành viên vắng`;
    if(!box.hidden)box.querySelector('p').textContent=`Các ảnh này đã được ghi nhận review xong. Nếu giao lại, người nhận cần biết tiến độ cũ để tránh làm lại hoặc mất dấu lịch sử.`;
   }else check.checked=false;
  }catch(e){box.hidden=true;check.checked=false;}
 }
 function syncMemberCard(card,input,status){
  const active=input.checked;
  card.classList.toggle('is-active',active);card.classList.toggle('is-away',!active);
  status.textContent=active?'Đang tham gia':'Không tham gia';
  const lockButton=card.querySelector('.allocLockButton');
  if(lockButton)lockButton.disabled=!active;
 }
 function renderMembers(reset=false){const host=$('allocMembers');host.replaceChildren();
  try{const data=manifest();const signature=data.rows.length+':'+data.owners.join('|')+':'+data.rows.slice(0,3).map(x=>x.image_id).join('|');
   if(reset||ui.loadedSignature!==signature){ui.selected=new Set(data.owners);ui.locked=new Set();ui.loadedSignature=signature;clearResult();}
   const counts=new Map(data.owners.map(x=>[x,0])),doneCounts=new Map(data.owners.map(x=>[x,0]));for(const r of data.rows){counts.set(r.assigned_reviewer_id,counts.get(r.assigned_reviewer_id)+1);if(/^(done|completed|reviewed|approved|accepted|finished|verified)$/i.test(s(r.status)))doneCounts.set(r.assigned_reviewer_id,doneCounts.get(r.assigned_reviewer_id)+1);}
   $('allocMemberCaption').textContent=`${ui.selected.size}/${data.owners.length} thành viên đang tham gia`;
   for(const m of data.owners){
    const card=node('div',null,'allocMemberCard');
    const label=node('label',null,'allocMemberSelect');
    const input=document.createElement('input');input.type='checkbox';input.checked=ui.selected.has(m);input.setAttribute('aria-label',m+' tham gia');
    const heading=node('span',null,'allocMemberIdentity');heading.append(node('strong',m),node('span',null,'allocMemberSelectHint'));
    const status=heading.lastElementChild;
    label.append(input,heading);card.append(label);
    const metrics=node('div',null,'allocMemberMetrics');
    const count=node('span');count.append(node('b',String(counts.get(m))),document.createTextNode(' ảnh gốc'));
    const done=node('span');done.append(node('b',String(doneCounts.get(m))),document.createTextNode(' đã hoàn tất'));
    metrics.append(count,done);card.append(metrics);
    const lockButton=node('button',null,'allocLockButton');lockButton.type='button';
    const syncLock=()=>{const locked=ui.locked.has(m);lockButton.textContent=locked?'Đã khóa phân công':'Giữ nguyên cả phần việc';lockButton.setAttribute('aria-pressed',String(locked));lockButton.setAttribute('aria-label',`${locked?'Bỏ khóa':'Khóa'} phần việc của ${m}`);};
    syncLock();lockButton.addEventListener('click',()=>{if(ui.locked.has(m))ui.locked.delete(m);else ui.locked.add(m);syncLock();clearResult();});
    card.append(lockButton);
    input.addEventListener('change',()=>{
     if(input.checked)ui.selected.add(m);else{ui.selected.delete(m);ui.locked.delete(m);syncLock();}
     $('allocMemberCaption').textContent=`${ui.selected.size}/${data.owners.length} thành viên đang tham gia`;
     syncMemberCard(card,input,status);clearResult();renderRing();renderCompletedWarning();
    });
    syncMemberCard(card,input,status);host.append(card);
   }
   renderRing();renderCompletedWarning();
  }catch(e){$('allocMemberCaption').textContent=e.message;renderCompletedWarning();}
 }
 function renderRing(){const order=[...ui.selected].sort(sort);$('allocRingPreview').textContent=order.length>=2?order.map((x,i)=>x+' → '+order[(i+($('allocRingDirection').value==='-1'?-1:1)+order.length)%order.length]).join('   ·   '):'Cần ít nhất hai người đang tham gia.';}
 function preview(){try{
   const result=engine.plan(collect());ui.plan=result;ui.files=engine.exportsFor(result);renderResults(result);
   $('allocResults').hidden=false;$('allocPreviewStatus').textContent=result.errors.length?'Có lỗi, chưa thể xuất':`Đã kiểm tra ${result.rows.length} ảnh · ${result.assignments.length} ảnh kiểm chéo`;
   for(const id of ['allocZip','allocExportChoice','allocExportSingle','allocSessionSave','allocApply'])$(id).disabled=!!result.errors.length;
   const options=$('allocExportChoice');options.replaceChildren();for(const name of Object.keys(ui.files).sort(sort))options.append(new Option(name,name));
   notice(result.errors.length?result.errors.join('; '):`Sẵn sàng: ${result.transfers.length} ảnh được chia lại; ${result.random.length} random, ${result.targeted.length} targeted.`,!!result.errors.length);
  }catch(e){clearResult();$('allocPreviewStatus').textContent=e.message;notice(e.message,true);}
 }
 function renderResults(p){
  const host=$('allocResultsKpis');host.replaceChildren();kpi(host,p.transfers.length,'Ảnh chuyển người review');kpi(host,p.random.length+' / '+p.targetAll,'Ảnh random / yêu cầu nhóm');kpi(host,p.countsBySource.generated_supplement,'Random bổ sung');kpi(host,p.officialImported?p.originalRetained:'0 · mẫu tự tạo','ID mẫu chính thức giữ lại');
  const checks=$('allocChecks');checks.replaceChildren();const items=[
   [p.rows.length===new Set(p.proposed.map(x=>x.image_id)).size,'Mỗi image_id có đúng 1 reviewer trong manifest đề xuất'],
   [p.assignments.every(x=>p.active.includes(x.original_reviewer_id)&&p.active.includes(x.checker_id)&&x.checker_id!==x.original_reviewer_id),'Không self-check; không còn reviewer/checker vắng trong mẫu'],
   [p.random.length>=p.targetAll,`Random toàn nhóm ${p.random.length}/${p.targetAll} ảnh tối thiểu`],
   [p.stats.every(x=>x.random>=x.required),'Random ≥10% theo từng tập ảnh của mỗi người'],
   [p.officialImported?p.originalRetained===p.officialCount:true,p.officialImported?`Bảo toàn ${p.originalRetained}/${p.officialCount} ID mẫu cấp`:'Không có mẫu cấp: mẫu mới không mạo nhận là mẫu gốc'],
   [p.errors.length===0,'Không có lỗi chặn xuất']
  ];for(const [valid,label] of items){const d=node('div',`${valid?'✓':'✕'} ${label}`,valid?'':'bad');checks.append(d);}
  const tbody=$('allocStatsRows');tbody.replaceChildren();for(const st of p.stats){const tr=document.createElement('tr');
   for(const value of [st.member,st.oldCount,st.transferred,st.reviewCount,st.weight,`${st.random} / ${st.required}`,st.toCheck,st.status])cell(tr,value);
   tr.lastElementChild.dataset.status=st.status==='Đạt'?'ok':'bad';tbody.append(tr);
  }
  const table=$('allocMatrix');table.replaceChildren();const head=document.createElement('thead'),htr=document.createElement('tr');cell(htr,'Review ↓ / Kiểm →','th');for(const m of p.active)cell(htr,m,'th');head.append(htr);table.append(head);
  const body=document.createElement('tbody');for(const owner of p.active){const row=document.createElement('tr');cell(row,owner);for(const checker of p.active)cell(row,p.assignments.filter(x=>x.original_reviewer_id===owner&&x.checker_id===checker).length);body.append(row);}table.append(body);
  const log=$('allocChangesRows');log.replaceChildren();$('allocChangedCount').textContent=`(${p.changes.length} thay đổi)`;
  for(const x of p.changes.slice(0,130)){const tr=document.createElement('tr');cell(tr,x.image_id);cell(tr,`${x.old_reviewer_id} → ${x.new_reviewer_id}`);cell(tr,`${x.old_checker_id||'—'} → ${x.new_checker_id||'—'}`);cell(tr,x.change_reason);log.append(tr);}
  const warnings=$('allocWarnings');warnings.replaceChildren();if(p.changes.length>130)warnings.append(node('div',`Đang xem 130/${p.changes.length} thay đổi; file CSV xuất có đủ toàn bộ.`));
  for(const x of p.warnings)warnings.append(node('div','Chưa xác minh / Lưu ý: '+x));
  warnings.append(node('div',`Phân tầng được kiểm theo metadata manifest hiện có (camera, session, box count). Chưa thay thế bước xem ảnh thực tế và kiểm tra các ca khó.`));
 }
 async function loadOptional(file,kind){if(!file)return;try{if(file.size>15*1024*1024)throw Error('CSV quá 15 MB.');const parsed=engine.parseCSV(await file.text());
   if(kind==='official'){
    for(const k of engine.R)if(!parsed.fields.includes(k))throw Error(`CSV thiếu cột ${k}.`);
    ui.official={...parsed,fileName:file.name};
   }else{
    if(!parsed.fields.includes('image_id'))throw Error('review_log.csv thiếu image_id.');
    if(!parsed.fields.some(k=>['reviewed_at','status','result'].includes(k)))throw Error('review_log.csv cần reviewed_at, status hoặc result để xác định ảnh đã làm.');
    ui.log={...parsed,fileName:file.name};
   }clearResult();renderSources();renderCompletedWarning();notice(`Đã đọc ${file.name} (${parsed.rows.length} dòng), sẽ kiểm tra liên kết ID khi tính phân công.`);
  }catch(e){notice(`Không nạp ${file.name}: ${e.message}`,true);}
 }
 function downloadText(name,content){const blob=new Blob([content],{type:name.endsWith('.json')?'application/json;charset=utf-8':'text/plain;charset=utf-8'});saveBlob(name,blob);}
 function saveBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function downloadZip(){if(!ui.plan||!ui.files||ui.plan.errors.length)return;try{if(typeof JSZip==='undefined')throw Error('Không có thư viện ZIP offline.');const zip=new JSZip();for(const [name,text] of Object.entries(ui.files))zip.file(name,text);$('allocZip').disabled=true;$('allocZip').textContent='Đang đóng ZIP…';const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});saveBlob(`chia_viec_${ui.plan.group}_${ui.plan.active.length}thanhvien.zip`,blob);notice('Đã yêu cầu tải ZIP chứa các bảng CSV, README và danh sách ảnh nhận thêm theo thành viên; không bao gồm file ảnh gốc.');}catch(e){notice(e.message,true);}finally{$('allocZip').disabled=false;$('allocZip').textContent='Tải toàn bộ ZIP';}}
 function session(){if(!ui.plan)throw Error('Chưa có phương án.');return JSON.stringify({format:'YOLO-ALLOCATION-SESSION-7',createdAt:new Date().toISOString(),manifest:{fields:ui.plan.fields,rows:ui.plan.rows},official:sourceOfficial(),reviewLog:ui.log,selected:[...ui.selected],locked:[...ui.locked],options:{reviewMode:document.querySelector('input[name="allocReviewMode"]:checked').value,checkerMode:$('allocCheckerMode').value,direction:$('allocRingDirection').value,seed:$('allocSeed').value,targeted:$('allocTargeted').value,allowCompleted:$('allocAllowCompleted').checked}},null,2);}
 async function restore(file){if(!file)return;try{if(file.size>15*1024*1024)throw Error('Phiên JSON vượt 15 MB.');const o=JSON.parse(await file.text());if(o.format!=='YOLO-ALLOCATION-SESSION-7'||!o.manifest?.rows||!Array.isArray(o.selected))throw Error('Đây không phải phiên Chia việc v7.');engine.manifestInput(o.manifest);ui.sessionManifest=o.manifest;ui.official=o.official||null;ui.log=o.reviewLog||null;
   renderMembers(true);ui.selected=new Set(o.selected);ui.locked=new Set(o.locked||[]);const c=o.options||{};
   if(['preserve','rebalance'].includes(c.reviewMode))document.querySelector(`input[name="allocReviewMode"][value="${c.reviewMode}"]`).checked=true;
   $('allocCheckerMode').value=c.checkerMode||'preserve';$('allocRingDirection').value=c.direction||'1';$('allocSeed').value=c.seed??2026;$('allocTargeted').value=c.targeted??0;$('allocAllowCompleted').checked=!!c.allowCompleted;
   renderSources();renderRing();renderMembers();renderCompletedWarning();clearResult();notice(`Khôi phục phiên ${file.name}. Manifest chỉ ở khu vực 07; muốn áp dụng cho các mục khác cần bấm xác nhận sau khi kiểm tra.`);
  }catch(e){notice('Không khôi phục phiên: '+e.message,true);}
 }
 function apply(){if(!ui.plan||ui.plan.errors.length)return;const p=ui.plan;const ic=window.YoloInternalCrosscheck?.getSummary?.();const warning=`Áp dụng manifest đề xuất ${p.rows.length} ảnh cho mục 01, 04 và 06 trong phiên trình duyệt?\n\nThay đổi ${p.transfers.length} reviewer; ${p.changes.length} nhật ký sửa phân công.\n\n${ic?.done?`${ic.done} kết luận kiểm chéo nội bộ đã ghi có thể bị vô hiệu hóa.\n\n`:''}Hãy tải ZIP trước. Dữ liệu trên máy vẫn không thay đổi.`;
  if(!window.confirm(warning))return;
  // Preserve the source file bytes on disk; runtime state changes are explicit and reversible through re-import.
  state.manifest={fields:[...p.fields],rows:p.proposed.map(r=>({...r}))};state.fileOrigins.manifest='Đề xuất mục 07 (chưa thay file gốc)';
  ui.sessionManifest=null;ui.applied=true;$('manifestName').textContent=`Đề xuất mục 07 · ${p.rows.length} ảnh / ${p.active.length} thành viên (chỉ trong phiên)`;
  window.dispatchEvent(new Event('yolo:manifest-updated'));notice(`Đã áp dụng manifest đề xuất vào phiên: ${p.rows.length} ảnh / ${p.active.length} thành viên. Tải lại gói ZIP nếu đổi dữ liệu.`);
 }
 $('allocAllMembers').onclick=()=>{try{ui.selected=new Set(manifest().owners);renderMembers();clearResult();}catch(e){notice(e.message,true);}};
 $('allocGoManifest').addEventListener('click',()=>$('uploadHub')?.scrollIntoView({behavior:'smooth',block:'start'}));
 for(const id of ['allocCheckerMode','allocRingDirection','allocSeed','allocTargeted','allocAllowCompleted'])$(id).addEventListener('change',()=>{clearResult();renderRing();});
 for(const x of document.querySelectorAll('input[name="allocReviewMode"]'))x.addEventListener('change',clearResult);
 $('allocPreview').onclick=preview;$('allocZip').onclick=()=>void downloadZip();$('allocExportSingle').onclick=()=>{if(ui.files){const name=$('allocExportChoice').value;downloadText(name.split('/').pop(),ui.files[name]);}};
 $('allocSessionSave').onclick=()=>{try{downloadText(`chia_viec_phien_${ui.plan.group}.json`,session());}catch(e){notice(e.message,true);}};
 $('allocApply').onclick=apply;
 window.addEventListener('yolo:manifest-updated',()=>{if(ui.applied){ui.applied=false;renderSources();return;}ui.sessionManifest=null;renderSources();renderMembers();clearResult();});
 // Optional files and session restores arrive only from the existing two pickers in section 01.
 window.addEventListener('yolo:allocation-input',e=>{const {kind,file}=e.detail||{};
  if(!file)return;
  if(kind==='official'||kind==='log')void loadOptional(file,kind);
  else if(kind==='session')void restore(file);
 });
 window.YoloAllocation={preview,collect,getPlan:()=>ui.plan,hasSessionData:()=>!!(ui.official||ui.log||ui.sessionManifest||ui.plan)};
 renderSources();renderMembers();
})();
