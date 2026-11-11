const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/scripts/v700AssignmentEngine.js');
const names=Array.from({length:10},(_,i)=>`G27_SV${String(i+1).padStart(2,'0')}`);
function fixture(N=1195, roster=names){const fields=['image_id','group_id','assigned_reviewer_id','planned_checker_id','difficulty_weight','camera_id','session_id','baseline_box_count','baseline_count_1','baseline_count_3','image_sha256','status'];
 return {fields,rows:Array.from({length:N},(_,i)=>{const j=i%roster.length;return {image_id:`frame_${String(i).padStart(5,'0')}`,group_id:roster[j].split('_')[0],assigned_reviewer_id:roster[j],planned_checker_id:roster[(j+1)%roster.length],difficulty_weight:String(20+((i*43)%81)),camera_id:'cam'+(i%3),session_id:'sess'+(i%5),baseline_box_count:String(i%50),baseline_count_1:String(i%7===0?1:0),baseline_count_3:String(i%11===0?1:0),image_sha256:'hash_'+i,status:''};})};}
const data=fixture();const active=names.filter(x=>x!=='G27_SV10');
const run=o=>E.plan({manifest:data,active,seed:2026,...o});
const official=()=>({fields:E.R,rows:E.stratifiedPick(data.rows,120,E.rngWithSeed(2026)).map(r=>({image_id:r.image_id,original_reviewer_id:r.assigned_reviewer_id,checker_id:r.planned_checker_id,check_type:'random'}))});
test('01 - generic 10→9, source manifest only, balanced 132/133 and weights',()=>{
 const p=run();assert.equal(p.rows.length,1195);assert.equal(p.transfers.length,data.rows.filter(x=>x.assigned_reviewer_id===names[9]).length);
 assert.equal(new Set(p.proposed.map(x=>x.image_id)).size,1195);assert.ok(p.proposed.every(x=>x.assigned_reviewer_id!==names[9]));
 assert.ok(p.stats.every(x=>[132,133].includes(x.reviewCount)));assert.ok(Math.max(...p.stats.map(x=>x.weight))-Math.min(...p.stats.map(x=>x.weight))<=90);
 assert.equal(p.errors.length,0);assert.equal('useExcel' in p,false);
});
test('02 - absent SV05 changes nobody else and IDs intact',()=>{
 const absent=names[4],p=run({active:names.filter(x=>x!==absent)});
 assert.equal(p.transfers.length,data.rows.filter(r=>r.assigned_reviewer_id===absent).length);
 for(const r of p.rows)if(r.assigned_reviewer_id!==absent)assert.equal(p.assigned.get(r.image_id),r.assigned_reviewer_id);
 assert.ok(!p.active.includes(absent)&&p.active.includes(names[9]));
});
test('03 - multiple absences, no spreadsheet-specific assumptions',()=>{
 const ro=names.filter((_,i)=>![3,6,8].includes(i));const p=run({active:ro});
 assert.equal(p.active.length,7);assert.equal(p.stats.reduce((a,b)=>a+b.reviewCount,0),1195);
 assert.ok(p.proposed.every(x=>ro.includes(x.assigned_reviewer_id)&&ro.includes(x.planned_checker_id)));
});
test('04 - original 120 sample preserved exactly; no self-check after transfer',()=>{
 const orig=official(),p=run({official:orig});const ids=new Set(orig.rows.map(x=>x.image_id));
 assert.equal(p.originalRetained,120);assert.ok(p.assignments.filter(x=>ids.has(x.image_id)).length===120);
 assert.ok(p.assignments.every(x=>x.original_reviewer_id!==x.checker_id));
 assert.ok(p.stats.every(x=>x.random>=x.required));
 assert.ok(p.random.length>=120);
});
test('05 - if checker becomes current owner, auto-fix and change logged',()=>{
 const base=run(),moved=base.transfers[0],orig=official();
 const pos=orig.rows.findIndex(x=>x.image_id===moved.image_id);orig.rows[pos>=0?pos:0]={image_id:moved.image_id,original_reviewer_id:moved.old_reviewer_id,checker_id:moved.new_reviewer_id,check_type:'random'};
 const p=run({official:orig}),row=p.assignments.find(x=>x.image_id===moved.image_id);
 assert.notEqual(row.checker_id,moved.new_reviewer_id);
 assert.ok(p.changes.some(x=>x.image_id===moved.image_id&&x.change_reason.includes('checker_reassigned')));
});
test('06 - per reviewer 10% can require more than group 10%',()=>{
 const m=fixture(100,names.slice(0,3)),p=E.plan({manifest:m,active:names.slice(0,3)});
 assert.equal(p.targetAll,10);assert.ok(p.random.length>=12);assert.ok(p.stats.every(x=>x.random>=Math.ceil(x.reviewCount/10)));
});
test('07 - deterministic seed, different seed changes supplemental sample',()=>{
 const a=run(),b=run(),c=run({seed:2027});
 assert.deepEqual(a.assignments,b.assignments);assert.notDeepEqual(a.assignments,c.assignments);
});
test('08 - log prevents silent reassignment of finished absent-member image',()=>{
 const r=data.rows.find(x=>x.assigned_reviewer_id===names[9]);
 const reviewLog=[{image_id:r.image_id,reviewed_at:'2026-01-02T13:05:00+07:00'}];
 assert.throws(()=>run({reviewLog}),/xác nhận chuyển quyền/);
 assert.doesNotThrow(()=>run({reviewLog,allowCompletedTransfer:true}));
});
test('09 - manifest completed status is honored without extra log',()=>{
 const m=fixture(),r=m.rows.find(x=>x.assigned_reviewer_id===names[9]);r.status='completed';
 assert.throws(()=>run({manifest:m}),/xác nhận chuyển quyền/);
});
test('10 - missing metadata flags unverified, no fabricated strata',()=>{
 const m=fixture();for(const x of m.rows){x.camera_id='';x.session_id='';x.difficulty_weight='';}
 const p=run({manifest:m});assert.ok(p.warnings.some(x=>x.includes('camera_id')));
});
test('11 - targeted never counts as mandatory random',()=>{
 const p=run({targetedCount:12});assert.equal(p.targeted.length,12);assert.ok(p.random.length>=120);
 assert.equal(new Set(p.assignments.map(x=>x.image_id)).size,p.assignments.length);
});
test('12 - exact schema and metadata preserved across CSV',()=>{
 const p=run({official:official()}),out=E.exportsFor(p,'2026-11-11T06:00:00+07:00');
 assert.deepEqual(E.parseCSV(out['crosscheck_assignments.csv']).fields,E.R);
 const log=E.parseCSV(out['crosscheck_log_template.csv']);assert.deepEqual(log.fields,E.LOG);
 assert.ok(log.rows.every(x=>!x.result&&!x.checked_at&&!x.resolution));
 const csv=E.parseCSV(out['assignment_manifest_proposed.csv']);assert.equal(csv.rows.length,1195);
 assert.deepEqual(csv.rows.map(r=>r.image_sha256),data.rows.map(r=>r.image_sha256));
 assert.equal(E.parseCSV(E.csv(['note'],[{note:'Tiếng Việt "đúng" và dấu, phẩy'}])).rows[0].note,'Tiếng Việt "đúng" và dấu, phẩy');
});
test('13 - missing manifest, duplicate ID, invalid member rejected',()=>{
 assert.throws(()=>E.plan({active}),/manifest/i);
 const m=fixture();m.rows[1].image_id=m.rows[0].image_id;
 assert.throws(()=>run({manifest:m}),/trùng/i);
 assert.throws(()=>run({active:['G27_SV00','G27_SV01']}),/không tồn tại/);
});
test('14 - malformed official sample refused instead of deleting original',()=>{
 const orig=official();orig.rows[0].image_id='unknown_image';
 assert.throws(()=>run({official:orig}),/không thuộc manifest/);
});
test('15 - switching checker mode preserves randomly sampled IDs',()=>{
 const orig=official();const a=run({official:orig,checkerMode:'preserve'}),b=run({official:orig,checkerMode:'ring',direction:-1});
 const ids=new Set(orig.rows.map(x=>x.image_id));for(const p of [a,b])assert.deepEqual(new Set(p.assignments.filter(x=>ids.has(x.image_id)).map(x=>x.image_id)),ids);
 assert.ok(b.assignments.every(x=>x.checker_id!==x.original_reviewer_id));
});
test('16 - lock members in rebalance mode preserves their work',()=>{
 const p=run({reviewMode:'rebalance',lockedMembers:[names[0]]});
 for(const r of p.rows.filter(x=>x.assigned_reviewer_id===names[0]))assert.equal(p.assigned.get(r.image_id),names[0]);
});
test('17 - completed-transfer prompt is conditional on an absent owner with completed images',()=>{
 const m=fixture(100), done=m.rows.find(x=>x.assigned_reviewer_id===names[9]);
 assert.equal(E.completedTransferInfo({manifest:m,active}).count,0);
 done.status='done';
 const info=E.completedTransferInfo({manifest:m,active});
 assert.equal(info.count,1);assert.deepEqual(info.examples,[done.image_id]);
 assert.equal(E.completedTransferInfo({manifest:m,active:names}).count,0);
 done.status='not_started';
 assert.equal(E.completedTransferInfo({manifest:m,active,reviewLog:[{image_id:done.image_id,reviewed_at:'2026-11-11'}]}).count,1);
});
