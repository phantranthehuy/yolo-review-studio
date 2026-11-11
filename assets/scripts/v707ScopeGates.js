/* v7.0.7 · Chỉ hiển thị workspace kiểm chéo khi có tệp phân công đúng loại. */
(function(){
'use strict';
const specs=[
 {id:'internalCrosscheckWorkspace',kind:'internal',title:'Chưa có phân công kiểm tra nội bộ',file:'crosscheck_assignments.csv',detail:'Nạp tệp phân công nội bộ tại mục 01. Sau khi tệp hợp lệ được nhận, bộ lọc, ảnh và biểu mẫu kết luận sẽ tự hiện.'},
 {id:'intergroupWorkspace',kind:'intergroup',title:'Chưa có phân công kiểm giữa nhóm',file:'intergroup_assignments.csv',detail:'Nạp tệp phân công liên nhóm tại mục 01. Khi tệp hợp lệ được nhận, phần kiểm giữa nhóm sẽ hiện; ảnh và nhãn nguồn có thể bổ sung sau.'}
];
function ready(kind){
 if(kind==='internal')return (window.YoloInternalCrosscheck?.getSummary?.().assigned||0)>0;
 const s=window.YoloIntergroup?.getSummary?.();return Boolean(s?.assignmentFile && s.assignmentTotal>0);
}
for(const item of specs){
 const target=document.getElementById(item.id);if(!target)continue;
 const gate=document.createElement('div');gate.className='scopeMissingNotice';gate.setAttribute('role','status');gate.setAttribute('aria-live','polite');
 const symbol=document.createElement('span');symbol.className='scopeMissingIcon';symbol.textContent='i';symbol.setAttribute('aria-hidden','true');
 const content=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;
 const descr=document.createElement('p');descr.textContent=item.detail;
 const action=document.createElement('a');action.href='#uploadHub';action.textContent='Đến mục 01 để nạp '+item.file;
 content.append(title,descr,action);gate.append(symbol,content);target.prepend(gate);
 item.target=target;item.gate=gate;
}
function update(){for(const item of specs){if(!item.target)continue;const missing=!ready(item.kind);item.target.classList.toggle('scopePending',missing);item.gate.hidden=!missing;}}
// Sự kiện sau khi dữ liệu được nhận/xóa, và ngay khi bấm các thẻ chế độ.
window.addEventListener('yolo:intergroup-updated',update);
window.addEventListener('yolo:internal-updated',update);
for(const id of ['matchScopeMain','matchScopeInternal','matchScopeInter']){
 document.getElementById(id)?.addEventListener('click',()=>queueMicrotask(update));
}
update();
})();
