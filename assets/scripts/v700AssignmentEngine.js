/* YOLO Review Studio · 07 Chia việc: pure planner. Offline; CommonJS export for node --test. */
(function(root, factory){
  const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api;
  if(root)root.YoloAssignmentEngine=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='7.0.0';
 const R=['image_id','original_reviewer_id','checker_id','check_type'];
 const LOG=['image_id','checker_id','original_reviewer_id','result','error_type','resolution','check_type','checked_revision','checked_at','decision_id'];
 const CHANGES=['image_id','old_reviewer_id','new_reviewer_id','old_checker_id','new_checker_id','change_reason','source'];
 const SAMPLING=['dimension','group','population_count','random_count','targeted_count','original_import_count','generated_initial_count','generated_supplement_count','seed','verification'];
 const trim=x=>String(x??'').trim();
 const sort=(a,b)=>a.localeCompare(b,'en');
 const ceil10=n=>Math.ceil(n/10-1e-10);
 const safeId=x=>/^[A-Za-z0-9_-]{1,128}$/.test(x);
 const completedStatus=s=>/^(done|completed|reviewed|approved|accepted|finished|verified|hoan_thanh)$/i.test(trim(s));
 function parseCSV(input){
  const s=String(input??'').replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false,justClosed=false,line=1,start=1;
  for(let i=0;i<s.length;i++){
   const c=s[i];
   if(c==='"'){
    if(quoted&&s[i+1]==='"'){cell+='"';i++;}
    else if(quoted){quoted=false;justClosed=true;}
    else if(cell===''){quoted=true;justClosed=false;}
    else throw Error(`CSV dòng ${line}, cột ${row.length+1}: dấu nháy kép sai vị trí.`);
   }else if(c===','&&!quoted){row.push(cell);cell='';justClosed=false;}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(x=>trim(x)))rows.push({row,line:start});row=[];cell='';justClosed=false;line++;start=line;}
   else{if(justClosed)throw Error(`CSV dòng ${line}, cột ${row.length+1}: ký tự sau dấu nháy kép đóng.`);if(c==='\n')line++;cell+=c;}
  }
  if(quoted)throw Error(`CSV dòng ${start}: thiếu dấu nháy kép đóng.`);
  if(row.length||cell){row.push(cell);if(row.some(x=>trim(x)))rows.push({row,line:start});}
  if(!rows.length)throw Error('CSV rỗng.');
  const fields=rows.shift().row.map(trim);if(new Set(fields).size!==fields.length)throw Error('CSV: tên cột bị trùng.');
  return {fields,rows:rows.map(({row,line})=>{if(row.length!==fields.length)throw Error(`CSV dòng ${line}: cần ${fields.length} cột, nhận ${row.length}.`);
   return Object.fromEntries(fields.map((k,i)=>[k,trim(row[i])]));})};
 }
 function csv(fields, rows){const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\uFEFF'+fields.join(',')+'\r\n'+rows.map(r=>fields.map(k=>quote(r[k])).join(',')).join('\r\n')+'\r\n';}
 function rngWithSeed(seed){let x=(Number(seed)>>>0);return ()=>{x=(x+0x6D2B79F5)|0;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
 function shuffle(list, rng){const a=[...list].sort((a,b)=>sort(a.image_id,b.image_id));for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function density(x){const n=Number(x.baseline_box_count);return x.baseline_box_count===''||x.baseline_box_count==null?'unknown':n<12?'low':n<35?'mid':'high';}
 function stratum(x){const rare=(x.baseline_count_1==null||x.baseline_count_3==null)?'rare_unknown':(Number(x.baseline_count_1)>0||Number(x.baseline_count_3)>0?'rare_present':'rare_absent');return [trim(x.camera_id)||'unknown',trim(x.session_id)||'unknown',density(x),rare].join(' / ');}
 function stratifiedPick(candidates,n,rng){
  if(n<=0)return [];
  const groups=new Map();for(const x of candidates){const k=stratum(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
  const arr=[...groups.entries()].sort((a,b)=>sort(a[0],b[0]));const N=candidates.length;
  if(n>N)throw Error(`Không đủ ảnh chưa chọn (${N}) để bổ sung ${n} ảnh.`);
  const quotas=arr.map(([k,values])=>({k,values:shuffle(values,rng),base:Math.floor(n*values.length/N),fraction:n*values.length/N%1}));
  let rem=n-quotas.reduce((s,q)=>s+q.base,0);const byRemainder=[...quotas].sort((a,b)=>b.fraction-a.fraction||sort(a.k,b.k));
  for(const q of byRemainder){if(rem<=0)break;if(q.base<q.values.length){q.base++;rem--;}}
  while(rem>0){const eligible=quotas.find(q=>q.base<q.values.length);if(!eligible)throw Error('Không đủ ảnh theo phân tầng.');eligible.base++;rem--;}
  return quotas.flatMap(q=>q.values.slice(0,q.base)).sort((a,b)=>sort(a.image_id,b.image_id));
 }
 function manifestInput(manifest){
  if(!manifest||!Array.isArray(manifest.rows)||!manifest.rows.length)throw Error('Cần assignment_manifest.csv đã nạp ở mục 01. Không thể lập owner từ 120 ảnh kiểm chéo.');
  const fields=manifest.fields||Object.keys(manifest.rows[0]);
  for(const k of ['image_id','assigned_reviewer_id'])if(!fields.includes(k))throw Error(`Manifest thiếu cột ${k}.`);
  const seen=new Set(),groups=new Set(),owners=new Set();
  const rows=manifest.rows.map((item,i)=>{
   const r={...item},id=trim(r.image_id),owner=trim(r.assigned_reviewer_id),group=trim(r.group_id)||owner.split('_')[0];
   if(!safeId(id))throw Error(`Manifest dòng ${i+2}, image_id: mã không hợp lệ.`);
   if(seen.has(id.toLowerCase()))throw Error(`Manifest dòng ${i+2}, image_id: trùng hoặc chỉ khác chữ hoa/thường (${id}).`);
   if(!/^G\d+_SV\d+$/i.test(owner))throw Error(`Manifest dòng ${i+2}, assigned_reviewer_id: mã thành viên thiếu hoặc sai (${owner||'rỗng'}).`);
   if(group!==owner.split('_')[0])throw Error(`Manifest dòng ${i+2}, group_id: không khớp reviewer.`);
   if(r.difficulty_weight!==''&&r.difficulty_weight!=null&&(!Number.isFinite(Number(r.difficulty_weight))||Number(r.difficulty_weight)<0))throw Error(`Manifest dòng ${i+2}, difficulty_weight: cần số không âm.`);
   seen.add(id.toLowerCase());groups.add(group);owners.add(owner);r.image_id=id;r.assigned_reviewer_id=owner;return r;
  });
  if(owners.size<2)throw Error(`Manifest chỉ có ${owners.size} người; cần assignment_manifest.csv của cả nhóm (ít nhất 2 người) để chia việc và kiểm chéo.`);
  if(groups.size>1)throw Error('Manifest có nhiều group_id; chỉ chia một nhóm mỗi lượt.');
  return {rows,fields,owners:[...owners].sort(sort),group:[...groups][0]};
 }
 function completedImages(rows,reviewLog){
  const allowed=new Set(rows.map(r=>r.image_id));
  const done=new Set(rows.filter(r=>completedStatus(r.status)||completedStatus(r.acceptance_status)).map(x=>x.image_id));
  if(reviewLog){for(const x of reviewLog){if(allowed.has(trim(x.image_id))&&(trim(x.reviewed_at)||completedStatus(x.status)||completedStatus(x.result)))done.add(trim(x.image_id));}}
  return done;
 }
 function completedTransferInfo({manifest,active=[],reviewLog=null}){
  const data=manifestInput(manifest),doing=new Set(active),done=completedImages(data.rows,reviewLog);
  const affected=data.rows.filter(x=>done.has(x.image_id)&&!doing.has(x.assigned_reviewer_id));
  return {count:affected.length,examples:affected.slice(0,3).map(x=>x.image_id)};
 }
 function plan(options){
  const {manifest,active,reviewMode='preserve',checkerMode='preserve',direction=1,seed=2026,official=null,
   allowCompletedTransfer=false,reviewLog=null,targetedCount=0,lockedMembers=[]}=options||{};
  const data=manifestInput(manifest),rows=data.rows,byId=new Map(rows.map(r=>[r.image_id,r]));
  const order=[...new Set(active||[])].sort(sort),allowed=new Set(data.owners);
  if(order.length<2)throw Error('Cần ít nhất 2 thành viên tham gia để checker khác reviewer.');
  for(const m of order)if(!allowed.has(m))throw Error(`Thành viên ${m} không tồn tại trong manifest.`);
  if(!['preserve','rebalance'].includes(reviewMode))throw Error('Chế độ chia review không hợp lệ.');
  if(!['preserve','ring','balanced'].includes(checkerMode))throw Error('Chế độ phân người kiểm không hợp lệ.');
  if(!Number.isSafeInteger(Number(seed))||Number(seed)<0||Number(seed)>4294967295)throw Error('Seed phải là số nguyên từ 0 đến 4294967295.');
  if(!Number.isInteger(Number(targetedCount))||Number(targetedCount)<0||Number(targetedCount)>rows.length)throw Error('Số targeted không hợp lệ.');
  const activeSet=new Set(order),lock=new Set(lockedMembers),absent=data.owners.filter(x=>!activeSet.has(x));
  const done=completedImages(rows,reviewLog);
  const frozen=rows.filter(x=>done.has(x.image_id)&&!activeSet.has(x.assigned_reviewer_id));
  if(frozen.length&&!allowCompletedTransfer)throw Error(`${frozen.length} ảnh đã được đánh dấu hoàn tất nhưng thuộc người vắng. Cần xác nhận chuyển quyền rõ ràng (ví dụ ${frozen[0].image_id}).`);
  const assigned=new Map(),counts=new Map(order.map(m=>[m,0])),weights=new Map(order.map(m=>[m,0])),transfers=[];
  const weight=x=>x.difficulty_weight===''||x.difficulty_weight==null?1:Number(x.difficulty_weight);
  function add(row,owner){assigned.set(row.image_id,owner);counts.set(owner,counts.get(owner)+1);weights.set(owner,weights.get(owner)+weight(row));
   if(row.assigned_reviewer_id!==owner)transfers.push({image_id:row.image_id,old_reviewer_id:row.assigned_reviewer_id,new_reviewer_id:owner});}
  const pending=[];for(const r of rows){if(activeSet.has(r.assigned_reviewer_id)&&(reviewMode==='preserve'||done.has(r.image_id)||lock.has(r.assigned_reviewer_id)))add(r,r.assigned_reviewer_id);else pending.push(r);}
  // Generic target capacities: count stays within floor/ceil when not constrained by locks.
  const baseCount=Math.floor(rows.length/order.length),extra=rows.length%order.length;
  const finalGoals=new Map(order.map(m=>[m,baseCount]));
  const goalOrder=[...order].sort((a,b)=>counts.get(b)-counts.get(a)||sort(a,b));
  for(const m of goalOrder.slice(0,extra))finalGoals.set(m,baseCount+1);
  const feasible=order.every(m=>counts.get(m)<=finalGoals.get(m));
  const tmpCounts=new Map(counts),tmpWeights=new Map(weights),pendingOwner=new Map();
  const totalWeight=rows.reduce((n,r)=>n+weight(r),0),goalWeight=totalWeight/order.length;
  // Prioritize heavy images and remaining average weight need, not spreadsheet image IDs.
  pending.sort((a,b)=>weight(b)-weight(a)||sort(a.image_id,b.image_id));
  for(const r of pending){const eligible=order.filter(m=>!feasible||tmpCounts.get(m)<finalGoals.get(m));
   const candidates=eligible.length?eligible:order;
   const choice=[...candidates].sort((a,b)=>{
    if(!feasible)return tmpCounts.get(a)-tmpCounts.get(b)||tmpWeights.get(a)-tmpWeights.get(b)||sort(a,b);
    const shortage=m=> (goalWeight-tmpWeights.get(m))/Math.max(1,finalGoals.get(m)-tmpCounts.get(m));
    return shortage(b)-shortage(a)||tmpCounts.get(a)-tmpCounts.get(b)||sort(a,b);
   })[0];
   pendingOwner.set(r.image_id,choice);tmpCounts.set(choice,tmpCounts.get(choice)+1);tmpWeights.set(choice,tmpWeights.get(choice)+weight(r));
  }
  // Local pair swaps of newly allocated images improve difficulty balance without changing
  // image counts, touching previously owned images, or importing any Excel mapping.
  if(pending.length>=2&&pending.length<=450&&feasible){
   const target=totalWeight/order.length;
   const gain=(a,b,delta)=>{const wa=tmpWeights.get(a)-target,wb=tmpWeights.get(b)-target;return wa*wa+wb*wb-(wa+delta)*(wa+delta)-(wb-delta)*(wb-delta);};
   for(let pass=0;pass<20;pass++){
    let best=0,left=null,right=null;
    for(let i=0;i<pending.length;i++)for(let j=i+1;j<pending.length;j++){
     const x=pending[i],y=pending[j],a=pendingOwner.get(x.image_id),b=pendingOwner.get(y.image_id);
     if(a===b)continue;const delta=weight(y)-weight(x),improvement=gain(a,b,delta);
     if(improvement>best+1e-7){best=improvement;left=x;right=y;}
    }
    if(!left)break;
    const a=pendingOwner.get(left.image_id),b=pendingOwner.get(right.image_id),delta=weight(right)-weight(left);
    pendingOwner.set(left.image_id,b);pendingOwner.set(right.image_id,a);
    tmpWeights.set(a,tmpWeights.get(a)+delta);tmpWeights.set(b,tmpWeights.get(b)-delta);
   }
  }
  for(const r of pending)add(r,pendingOwner.get(r.image_id));
  const pickRng=rngWithSeed(seed),originalRows=official?.rows||null,sourceById=new Map(),picked=new Map(),initialIDs=new Set(),targetAll=ceil10(rows.length);
  if(originalRows){
   const fields=official.fields||Object.keys(originalRows[0]||{});for(const k of R)if(!fields.includes(k))throw Error(`crosscheck_assignments.csv thiếu cột ${k}.`);
   for(const [i,x] of originalRows.entries()){
    const id=trim(x.image_id),type=trim(x.check_type);
    if(!byId.has(id))throw Error(`crosscheck_assignments.csv dòng ${i+2}, image_id: không thuộc manifest (${id}).`);
    if(picked.has(id))throw Error(`crosscheck_assignments.csv dòng ${i+2}, image_id: trùng (${id}).`);
    if(!allowed.has(trim(x.original_reviewer_id))||!/^G\d+_SV\d+$/i.test(trim(x.checker_id))||trim(x.checker_id).split('_')[0]!==data.group)throw Error(`crosscheck_assignments.csv dòng ${i+2}: reviewer/checker không thuộc mã thành viên nhóm này.`);
    if(!['random','targeted'].includes(type))throw Error(`crosscheck_assignments.csv dòng ${i+2}, check_type: chỉ random hoặc targeted.`);
    picked.set(id,{image_id:id,original_reviewer_id:assigned.get(id),checker_id:'',check_type:type});
    initialIDs.add(id);sourceById.set(id,'original_import');
   }
  }else{
   for(const x of stratifiedPick(rows,targetAll,pickRng)){
    picked.set(x.image_id,{image_id:x.image_id,original_reviewer_id:assigned.get(x.image_id),checker_id:'',check_type:'random'});
    sourceById.set(x.image_id,'generated_initial');initialIDs.add(x.image_id);
   }
  }
  const oldCheckers=new Map((originalRows||[]).map(x=>[trim(x.image_id),trim(x.checker_id)]));
  const checkLoads=new Map(order.map(m=>[m,0]));
  function ring(owner){const ix=order.indexOf(owner);return order[(ix+(Number(direction)===-1?-1:1)+order.length)%order.length];}
  function chooseChecker(entry){
   const owner=entry.original_reviewer_id,original=oldCheckers.get(entry.image_id),planned=trim(byId.get(entry.image_id).planned_checker_id);
   if(checkerMode==='ring')return ring(owner);
   if(checkerMode==='preserve'){
    if(activeSet.has(original)&&original!==owner)return original;
    if(!original&&activeSet.has(planned)&&planned!==owner)return planned;
   }
   return [...order].filter(m=>m!==owner).sort((a,b)=>checkLoads.get(a)-checkLoads.get(b)||sort(a,b))[0];
  }
  // Random batch in stable order, so preserving old checkers cannot depend on input row order.
  for(const entry of [...picked.values()].sort((a,b)=>sort(a.image_id,b.image_id))){entry.checker_id=chooseChecker(entry);checkLoads.set(entry.checker_id,checkLoads.get(entry.checker_id)+1);}
  const randomByOwner=new Map(order.map(m=>[m,0]));
  for(const x of picked.values())if(x.check_type==='random')randomByOwner.set(x.original_reviewer_id,randomByOwner.get(x.original_reviewer_id)+1);
  const deficits=[];
  for(const member of order){
   const needed=Math.max(0,ceil10(counts.get(member))-randomByOwner.get(member));
   const available=rows.filter(x=>assigned.get(x.image_id)===member&&!picked.has(x.image_id));
   const chosen=stratifiedPick(available,needed,pickRng);
   for(const r of chosen){const entry={image_id:r.image_id,original_reviewer_id:member,check_type:'random',checker_id:''};entry.checker_id=chooseChecker(entry);picked.set(r.image_id,entry);sourceById.set(r.image_id,'generated_supplement');checkLoads.set(entry.checker_id,checkLoads.get(entry.checker_id)+1);}
   randomByOwner.set(member,randomByOwner.get(member)+chosen.length);deficits.push({member,needed});
  }
  // Safety net for group level even if imported samples contain targeted rows.
  let totalRandom=[...picked.values()].filter(x=>x.check_type==='random').length;
  if(totalRandom<targetAll){
   const remaining=stratifiedPick(rows.filter(x=>!picked.has(x.image_id)),targetAll-totalRandom,pickRng);
   for(const r of remaining){const entry={image_id:r.image_id,original_reviewer_id:assigned.get(r.image_id),check_type:'random',checker_id:''};entry.checker_id=chooseChecker(entry);picked.set(r.image_id,entry);sourceById.set(r.image_id,'generated_supplement');checkLoads.set(entry.checker_id,checkLoads.get(entry.checker_id)+1);randomByOwner.set(entry.original_reviewer_id,randomByOwner.get(entry.original_reviewer_id)+1);}
  }
  // Targeted selection is outside the mandatory random threshold, with higher difficulty and rare class hints.
  const targetedPool=rows.filter(r=>!picked.has(r.image_id)).sort((a,b)=>{
   const rare=x=>Number(x.baseline_count_1||0)+Number(x.baseline_count_3||0);
   return rare(b)-rare(a)||weight(b)-weight(a)||sort(a.image_id,b.image_id);
  });
  if(Number(targetedCount)>targetedPool.length)throw Error('Không đủ ảnh chưa chọn để tạo mẫu targeted.');
  for(const r of targetedPool.slice(0,Number(targetedCount))){const entry={image_id:r.image_id,original_reviewer_id:assigned.get(r.image_id),check_type:'targeted',checker_id:''};entry.checker_id=chooseChecker(entry);picked.set(r.image_id,entry);sourceById.set(r.image_id,'generated_targeted');checkLoads.set(entry.checker_id,checkLoads.get(entry.checker_id)+1);}
  const assignments=[...picked.values()].sort((a,b)=>sort(a.image_id,b.image_id));
  const planned=new Map();for(const row of rows){const owner=assigned.get(row.image_id),old=trim(row.planned_checker_id);planned.set(row.image_id,activeSet.has(old)&&old!==owner?old:ring(owner));}
  for(const x of assignments)planned.set(x.image_id,x.checker_id);
  const proposed=rows.map(r=>({...r,assigned_reviewer_id:assigned.get(r.image_id),planned_checker_id:planned.get(r.image_id)}));
  const changes=rows.filter(r=>r.assigned_reviewer_id!==assigned.get(r.image_id)||trim(r.planned_checker_id)!==planned.get(r.image_id)||
   (picked.has(r.image_id)&&oldCheckers.has(r.image_id)&&(oldCheckers.get(r.image_id)!==picked.get(r.image_id).checker_id||trim(originalRows.find(x=>trim(x.image_id)===r.image_id).original_reviewer_id)!==assigned.get(r.image_id))))
   .map(r=>{
    const old=oldCheckers.get(r.image_id)||trim(r.planned_checker_id),now=planned.get(r.image_id),was=trim(r.assigned_reviewer_id),owner=assigned.get(r.image_id);
    return {image_id:r.image_id,old_reviewer_id:was,new_reviewer_id:owner,old_checker_id:old,new_checker_id:now,
     change_reason:[was!==owner?'reviewer_reassigned':null,old!==now?'checker_reassigned':null].filter(Boolean).join('+')||'reviewer_from_official_list_corrected',
     source:sourceById.get(r.image_id)||'manifest'};
   });
  for(const a of assignments){if(!initialIDs.has(a.image_id))changes.push({image_id:a.image_id,old_reviewer_id:byId.get(a.image_id).assigned_reviewer_id,new_reviewer_id:a.original_reviewer_id,old_checker_id:'',new_checker_id:a.checker_id,change_reason:'sample_added_'+a.check_type,source:sourceById.get(a.image_id)});}
  const random=assignments.filter(x=>x.check_type==='random'),targeted=assignments.filter(x=>x.check_type==='targeted'),stats=order.map(member=>{
   const owned=rows.filter(r=>assigned.get(r.image_id)===member);return {member,oldCount:rows.filter(r=>r.assigned_reviewer_id===member).length,reviewCount:owned.length,weight:weights.get(member),
    random:random.filter(x=>x.original_reviewer_id===member).length,targeted:targeted.filter(x=>x.original_reviewer_id===member).length,
    toCheck:assignments.filter(x=>x.checker_id===member).length,transferred:transfers.filter(x=>x.new_reviewer_id===member).length,
    required:ceil10(owned.length),status:'OK'};
  });
  for(const x of stats)x.status=x.random>=x.required?'Đạt':'Thiếu';
  const warnings=[];
  for(const k of ['camera_id','session_id','baseline_box_count','difficulty_weight','baseline_count_0','baseline_count_1','baseline_count_2','baseline_count_3'])if(rows.some(x=>x[k]===''||x[k]==null))warnings.push(`Thiếu ${k}: chưa kiểm chứng đầy đủ phân tầng/độ khó cho toàn bộ ảnh.`);
  if(!rows.some(x=>Number(x.baseline_count_1)>0||Number(x.baseline_count_3)>0))warnings.push('Không có dấu hiệu class hiếm trong metadata, không tự suy đoán.');
  warnings.push('Manifest không có lịch sử số lần chỉnh sửa nhãn và danh sách ảnh chờ phân xử: chưa xác minh được hai tầng này.');
  if(!reviewLog&&!rows.some(r=>completedStatus(r.status)||completedStatus(r.acceptance_status)))warnings.push('Chưa có trạng thái hoàn thành đáng tin cậy từ manifest hoặc review_log: không thể xác minh ảnh đã làm; cần kiểm tra trước khi áp dụng.');
  if(!official)warnings.push('Chưa nạp crosscheck_assignments.csv chính thức: 120 ảnh ban đầu là mẫu ngẫu nhiên công cụ tự tạo, KHÔNG được coi là mẫu cấp sẵn.');
  const errors=[];
  if(assignments.some(x=>x.checker_id===x.original_reviewer_id||!activeSet.has(x.checker_id)||!activeSet.has(x.original_reviewer_id)))errors.push('Tồn tại self-check hoặc người vắng.');
  if(new Set(assignments.map(x=>x.image_id)).size!==assignments.length)errors.push('Trùng image_id kiểm chéo.');
  if(random.length<targetAll)errors.push(`Mẫu random dưới ngưỡng ${targetAll}.`);
  if(stats.some(x=>x.status!=='Đạt'))errors.push('Có người thiếu tỷ lệ random 10%.');
  if(official&&initialIDs.size!==originalRows.length)errors.push('Có image_id mẫu gốc bị mất.');
  const countsBySource=Object.fromEntries(['original_import','generated_initial','generated_supplement','generated_targeted'].map(k=>[k,assignments.filter(x=>sourceById.get(x.image_id)===k).length]));
  return {version:VERSION,group:data.group,fields:data.fields,rows,proposed,assigned,planned,active:order,absent,stats,assignments,transfers,changes,random,targeted,officialImported:!!official,officialCount:originalRows?.length||0,originalRetained:originalRows?.length||0,
   warnings,errors,targetAll,seed:Number(seed),reviewMode,checkerMode,direction:Number(direction),lockedMembers:[...lock],sourceById,countsBySource,deficits,original:official?.rows||[],metadataVerification:warnings.length?'Chưa xác minh đầy đủ':'Đã xác minh theo trường hiện có'};
 }
 function samplingRows(plan){const dimensions=['camera_id','session_id','density','rare_class','original_reviewer_id','sample_source'];const out=[];
  for(const key of dimensions){const population=new Map(),samples=new Map();
   const value=(r)=>key==='density'?density(r):key==='rare_class'?(Number(r.baseline_count_1||0)>0||Number(r.baseline_count_3||0)>0?'có bus/truck':'không phát hiện bus/truck'):key==='original_reviewer_id'?plan.assigned.get(r.image_id):key==='sample_source'?'all':trim(r[key])||'unknown';
   for(const r of plan.rows){const k=value(r);population.set(k,(population.get(k)||0)+1);}
   for(const a of plan.assignments){const r=plan.rows.find(x=>x.image_id===a.image_id);const k=key==='sample_source'?plan.sourceById.get(a.image_id):value(r);const count=samples.get(k)||{random:0,targeted:0,orig:0,initial:0,supp:0};if(a.check_type==='random')count.random++;else count.targeted++;const source=plan.sourceById.get(a.image_id);if(source==='original_import')count.orig++;if(source==='generated_initial')count.initial++;if(source==='generated_supplement')count.supp++;samples.set(k,count);}
   for(const k of new Set([...population.keys(),...samples.keys()])){const x=samples.get(k)||{};out.push({dimension:key,group:k,population_count:population.get(k)||0,random_count:x.random||0,targeted_count:x.targeted||0,original_import_count:x.orig||0,generated_initial_count:x.initial||0,generated_supplement_count:x.supp||0,seed:plan.seed,verification:'Phân bố mô tả; không thay cho đánh giá bằng mắt'});}
  }
  return out.sort((a,b)=>sort(a.dimension,b.dimension)||sort(a.group,b.group));
 }
 function exportsFor(plan, now=''){
  if(plan.errors.length)throw Error('Không xuất vì lỗi: '+plan.errors.join('; '));
  const n=plan.active.length;
  const result={};const put=(name,fields,rows)=>{result[name]=csv(fields,rows);};
  put('crosscheck_assignments.csv',R,plan.assignments);
  put('crosscheck_log_template.csv',LOG,plan.assignments.map(x=>({image_id:x.image_id,checker_id:x.checker_id,original_reviewer_id:x.original_reviewer_id,check_type:x.check_type})));
  put(`review_assignments_${n}members.csv`,['image_id','reviewer_id'],plan.rows.map(x=>({image_id:x.image_id,reviewer_id:plan.assigned.get(x.image_id)})));
  put('crosscheck_changes.csv',CHANGES,plan.changes);
  put('crosscheck_sampling_report.csv',SAMPLING,samplingRows(plan));
  put('assignment_manifest_proposed.csv',plan.fields,plan.proposed);
  put('review_transfers.csv',['image_id','old_reviewer_id','new_reviewer_id'],plan.transfers);
  // Keep a copy of all original metadata in each transfer file, adding one explicit proposal field.
  for(const source of plan.absent){for(const m of plan.active){
   const transferred=plan.proposed.filter(x=>plan.rows.find(r=>r.image_id===x.image_id)?.assigned_reviewer_id===source&&x.assigned_reviewer_id===m);
   if(transferred.length){const originalById=new Map(plan.rows.map(x=>[x.image_id,x]));const fields=[...plan.fields,'proposed_reviewer_id'];
    put(`members/${m}/${source}_CUA_${m}.csv`,fields,transferred.map(x=>({...originalById.get(x.image_id),proposed_reviewer_id:m})));}
  }}
  put('members_summary.csv',['reviewer_id','old_count','transferred_in','new_count','total_difficulty_weight','random_checked','targeted_checked','checker_workload','random_required','status'],plan.stats.map(x=>({reviewer_id:x.member,old_count:x.oldCount,transferred_in:x.transferred,new_count:x.reviewCount,total_difficulty_weight:x.weight,random_checked:x.random,targeted_checked:x.targeted,checker_workload:x.toCheck,random_required:x.required,status:x.status})));
  const date=now||new Date().toISOString();
  result['README_crosscheck.txt']=[`YOLO Review Studio - Chức năng 07 Chia việc (engine ${plan.version})`,`Ngày xuất: ${date}`,`Nhóm: ${plan.group}`,`Tổng ảnh: ${plan.rows.length}`,`Thành viên đang làm (${plan.active.length}): ${plan.active.join(', ')}`,`Thành viên vắng: ${plan.absent.join(', ')||'không'}`,`Chế độ review: ${plan.reviewMode} (thuật toán tổng quát cân bằng số ảnh và trọng số)`,`Phân người kiểm: ${plan.checkerMode}; chiều vòng: ${plan.direction===-1?'ngược':'thuận'}`,`Mẫu gốc nhập: ${plan.officialImported?plan.officialCount:'KHÔNG CÓ - mẫu khởi tạo bởi công cụ'}`,`Số image_id của mẫu chính thức còn giữ: ${plan.originalRetained}`,`Random từ mẫu nhập: ${plan.countsBySource.original_import}`,`Random khởi tạo: ${plan.countsBySource.generated_initial}`,`Random bổ sung: ${plan.countsBySource.generated_supplement}`,`Targeted bổ sung: ${plan.countsBySource.generated_targeted}`,`Random tổng: ${plan.random.length}/${plan.rows.length} (yêu cầu >=${plan.targetAll})`,`Seed: ${plan.seed}; nguồn: assignment_manifest.csv đã nạp trong phiên`,`Mỗi người: ${plan.stats.map(x=>`${x.member} ${x.random}/${x.reviewCount} yêu cầu >=${x.required}`).join(' | ')}`,'','Cảnh báo / giới hạn:',...plan.warnings.map(x=>'- '+x),'','Danh sách đầu mối cấp: '+(plan.officialImported?'có nạp danh sách mẫu, chưa xác thực chữ ký nguồn':'KHÔNG cung cấp'),'Không thay đổi file nguồn trên ổ đĩa. assignment_manifest_proposed.csv là đề xuất, cần duyệt trước khi áp dụng.','members/<reviewer>/<người vắng>_CUA_<reviewer>.csv chỉ chứa ảnh nhận thêm và nguyên dữ liệu manifest.','Các result, error_type, resolution, checked_revision, checked_at, decision_id trong crosscheck_log_template.csv đều để trống.','Ngày/hash nguồn: không lưu file hash nếu không có bằng chứng tính toán.'].join('\r\n')+'\r\n';
  return result;
 }
 return {VERSION,R,LOG,CHANGES,parseCSV,csv,stratifiedPick,rngWithSeed,manifestInput,completedTransferInfo,plan,samplingRows,exportsFor};
});
