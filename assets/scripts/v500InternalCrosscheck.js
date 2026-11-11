/* YOLO Review Studio v5.0 - intra-group independent crosscheck, schema from PDF F.1. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('internalCrosscheckWorkspace'))return;
const IC={rows:[],byId:new Map(),fileName:'',selected:'',checks:new Map(),loaded:false,checkedImage:null,bitmap:null,bitmapUrl:'',a:[],b:[],zoom:1,cx:.5,cy:.5,drag:null,token:0,frame:0,parseError:'',lastOpen:''};
const fields=['image_id','checker_id','original_reviewer_id','result','error_type','resolution','check_type','checked_revision','checked_at','decision_id'];
const allowedTypes=new Set(['random','targeted']);
const allowedErrors=new Set(['missing','extra','duplicate','class','geometry','roi','metadata']);
const val=s=>String(s??'').trim();
const displayId=id=>id?.length>23?id.slice(0,12)+'…'+id.slice(-8):id;
function parseCSVStrict(s){
 const rows=[];let row=[],cell='',quoted=false;const text=String(s).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(cell==='')quoted=true;else throw Error('CSV có dấu nháy không hợp lệ.');}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSV bị thiếu dấu nháy đóng.');
 if(row.length||cell){row.push(cell);if(row.some(x=>x!==''))rows.push(row);}
 if(!rows.length)throw Error('CSV trống.');
 const cols=rows.shift().map(val);if(new Set(cols).size!==cols.length)throw Error('CSV trùng tên cột.');
 const needed=['image_id','original_reviewer_id','checker_id','check_type'];for(const k of needed)if(!cols.includes(k))throw Error('Thiếu cột '+k+' trong crosscheck_assignments.csv.');
 return rows.map((r,i)=>{if(r.length!==cols.length)throw Error(`CSV dòng ${i+2}: thừa/thiếu cột.`);return Object.fromEntries(cols.map((f,j)=>[f,val(r[j])]));});
}
function manifestById(){return new Map((state.manifest?.rows||[]).map(x=>[val(x.image_id),x]));}
function integrity(){
 const manifest=manifestById(),bad=[];
 for(const r of IC.rows){const m=manifest.get(r.image_id);if(manifest.size&&!m){bad.push(`${displayId(r.image_id)} không có trong manifest`);continue;}
  if(m&&val(m.assigned_reviewer_id).toUpperCase()!==r.original_reviewer_id.toUpperCase())bad.push(`${displayId(r.image_id)} không khớp người review gốc`);
  if(m&&val(m.planned_checker_id)&&val(m.planned_checker_id).toUpperCase()!==r.checker_id.toUpperCase())bad.push(`${displayId(r.image_id)} không khớp người kiểm được phân công`);
 }
 return bad;
}
async function ingestAssignments(file){
 if(!/^crosscheck[_-]?assignments(?:\s*\(\d+\))?\.csv$/i.test(file.name))throw Error('Chỉ nhận crosscheck_assignments.csv hoặc bản sao có (số).');
 const entries=parseCSVStrict(await file.text()),next=new Map();
 if(!entries.length)throw Error('Danh sách không có ảnh được giao kiểm.');
 for(const r of entries){
  if(!r.image_id||!/^[A-Za-z0-9_-]+$/.test(r.image_id))throw Error('image_id không hợp lệ: '+r.image_id);
  if(next.has(r.image_id))throw Error('Trùng image_id: '+r.image_id);
  if(!/^G\d{2}_SV\d{2}$/i.test(r.original_reviewer_id)||!/^G\d{2}_SV\d{2}$/i.test(r.checker_id))throw Error('reviewer/checker ID sai dạng G11_SV01 ở ảnh '+displayId(r.image_id));
  if(r.checker_id.toUpperCase()===r.original_reviewer_id.toUpperCase())throw Error('Người kiểm chéo trùng người rà soát ban đầu: '+displayId(r.image_id));
  if(r.checker_id.split('_')[0].toUpperCase()!==r.original_reviewer_id.split('_')[0].toUpperCase())throw Error('Kiểm nội bộ yêu cầu người cùng nhóm: '+displayId(r.image_id));
  if(!allowedTypes.has(r.check_type))throw Error('check_type phải random hoặc targeted ở ảnh '+displayId(r.image_id));
  next.set(r.image_id,r);
 }
 // File-specific commit is atomic; bad replacement leaves old assignments unchanged.
 const prev={rows:IC.rows,byId:IC.byId};IC.rows=entries;IC.byId=next;const errors=integrity();
 if(state.manifest?.rows?.length&&errors.length){IC.rows=prev.rows;IC.byId=prev.byId;throw Error(`Phân công không khớp manifest (${errors.length} lỗi): ${errors[0]}.`);}
 IC.fileName=file.name;IC.checks.clear();IC.selected='';IC.loaded=true;IC.lastOpen='';IC.a=[];IC.b=[];IC.parseError='';IC.bitmap=null;
 render();window.dispatchEvent(new CustomEvent('yolo:internal-updated'));return `Kiểm chéo nội bộ: nhận ${entries.length} ảnh từ ${file.name}, ${new Set(entries.map(x=>x.checker_id)).size} người kiểm. Kết luận cũ đã được làm mới.`;
}
function norm(name){return String(name||'').split('/').pop().replace(/\.txt$/i,'').replace(/\.rf\.[A-Za-z0-9_-]+$/i,'').replace(/(?:\.(?:png|jpe?g|webp|bmp)|_(?:png|jpe?g|webp|bmp))$/i,'');}
function getA(id){return state.after.find(f=>norm(f.name)===id)||null;}
function getB(id){return state.before.find(f=>norm(f.name)===id)||null;}
function getImg(id){return window.MatchReview?.getImageFile?.(id)||null;}
function parseBoxes(name,text){const out=[];String(text).replace(/^\uFEFF/,'').split(/\r?\n/).forEach((r,i)=>{
 if(!r.trim())return;
 const p=r.trim().split(/\s+/),c=Number(p[0]),g=p.slice(1).map(Number);
 if(p.length!==5||!/^[0-3]$/.test(p[0])||g.some(v=>!Number.isFinite(v))||g[2]<=0||g[3]<=0||g[0]-g[2]/2 < -1e-6||g[1]-g[3]/2 < -1e-6||g[0]+g[2]/2>1+1e-6||g[1]+g[3]/2>1+1e-6)
  throw Error(`${name}, dòng ${i+1}: box YOLO không hợp lệ.`);
 out.push({line:i+1,c,g});
 });return out;}
function setMessage(msg,bad=false){$('icMessage').textContent=msg;$('icMessage').classList.toggle('icBad',bad);}
function clearBitmap(){if(IC.bitmapUrl){URL.revokeObjectURL(IC.bitmapUrl);IC.bitmapUrl='';}IC.bitmap=null;}
function drawBox(ctx,b,W,H,x0,y0,zoomW,zoomH,color,label){
 // Draw annotations in screen pixels, not image-scaled font pixels.
 // Label text stays crisp/readable at 100% and 3200% zoom alike.
 const [x,y,w,h]=b.g;const xx=x0+(x-w/2)*zoomW,yy=y0+(y-h/2)*zoomH,ww=w*zoomW,hh=h*zoomH;
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(xx,yy,ww,hh);
 const cap=label+b.line+' · '+['2-wheel','bus','car','truck'][b.c];ctx.font='600 12px system-ui';
 const width=Math.min(W,ctx.measureText(cap).width+12),left=Math.max(0,Math.min(W-width,xx)),top=Math.max(1,yy-19);
 ctx.fillStyle='rgba(16,32,39,.94)';ctx.fillRect(left,top,width,18);ctx.fillStyle='#f2fbfd';ctx.fillText(cap,left+5,top+13);ctx.restore();
}
function paint(){IC.frame=0;const canvas=$('icCanvas');if(!canvas)return;
 const W=canvas.clientWidth||600,H=canvas.clientHeight||340,dpr=Math.min(2,window.devicePixelRatio||1);
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#102028';ctx.fillRect(0,0,W,H);
 const im=IC.bitmap;if(!im){ctx.font='14px system-ui';ctx.fillStyle='#b4cbd5';ctx.fillText('Nạp ảnh gốc và nhãn A, sau đó chọn ảnh được phân công.',16,32);return;}
 const scale=Math.min(W/im.naturalWidth,H/im.naturalHeight)*IC.zoom,dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;
 const x=W/2-IC.cx*dw,y=H/2-IC.cy*dh;ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();ctx.drawImage(im,x,y,dw,dh);
 if($('icShowBefore').checked)for(const b of IC.b)drawBox(ctx,b,W,H,x,y,dw,dh,'#5182f0','B');
 for(const b of IC.a)drawBox(ctx,b,W,H,x,y,dw,dh,'#01ab9a','A');
 ctx.restore();
}
function draw(){if(!IC.frame)IC.frame=requestAnimationFrame(paint);}
function filterRows(){let list=IC.rows;const who=$('icCheckerFilter').value,status=$('icStatusFilter').value;if(who)list=list.filter(x=>x.checker_id===who);
 if(status==='pending')list=list.filter(x=>!IC.checks.has(x.image_id));if(status==='done')list=list.filter(x=>IC.checks.has(x.image_id));if(status==='disagree')list=list.filter(x=>IC.checks.get(x.image_id)?.result==='disagree');return list;}
function render(){const total=IC.rows.length,done=IC.checks.size,errors=integrity(),manifestReady=!!state.manifest?.rows?.length;
 $('icOverview').replaceChildren();for(const [n,v] of [['Ảnh được phân công',total],['Đã kiểm',done],['Chưa kiểm',Math.max(0,total-done)],['Thành viên',new Set(IC.rows.map(r=>r.checker_id)).size]]){
  const d=document.createElement('div');d.className='icStat';const a=document.createElement('strong'),b=document.createElement('span');a.textContent=v;b.textContent=n;d.append(a,b);$('icOverview').append(d);
 }
 const note=$('icNotice');if(!IC.loaded){note.textContent='Nạp crosscheck_assignments.csv tại mục 01 để bật kiểm chéo nội bộ.';note.classList.remove('icBad');}
 else if(!manifestReady){note.textContent=`Đã nhận ${total} ảnh từ ${IC.fileName}. Cần assignment_manifest.csv để kiểm phân công trước khi lưu.`;note.classList.add('icBad');}
 else if(errors.length){note.textContent=`Phân công không khớp manifest: ${errors.length} lỗi. ${errors[0]}`;note.classList.add('icBad');}
 else{note.textContent=`${IC.fileName}: ${done}/${total} kết luận. Dữ liệu được tách khỏi kiểm chéo liên nhóm. Bản nháp được lưu trong phiên; hãy tải CSV để bàn giao.`;note.classList.remove('icBad');}
 const members=[...new Set(IC.rows.map(x=>x.checker_id))].sort();const filter=$('icCheckerFilter'),was=filter.value;filter.replaceChildren(new Option('Tất cả thành viên',''));for(const member of members)filter.append(new Option(member,member));filter.value=members.includes(was)?was:'';
 const prog=$('icMemberProgress');prog.replaceChildren();for(const member of members){const rows=IC.rows.filter(x=>x.checker_id===member),checked=rows.filter(x=>IC.checks.has(x.image_id)).length;
  const el=document.createElement('div');el.className='icMember';const name=document.createElement('b'),bar=document.createElement('div'),fill=document.createElement('span'),caption=document.createElement('small');name.textContent=member;bar.className='icTrack';fill.style.width=(checked/Math.max(1,rows.length)*100)+'%';bar.append(fill);caption.textContent=checked+'/'+rows.length+' ảnh';el.append(name,bar,caption);prog.append(el);}
 const ids=filterRows(),select=$('icImageSelect');select.replaceChildren();for(const r of ids){const symbol=IC.checks.has(r.image_id)?'✓ ':'· ';select.append(new Option(symbol+displayId(r.image_id)+' · '+r.checker_id,r.image_id));}
 if(!ids.some(r=>r.image_id===IC.selected))IC.selected='';if(!IC.selected&&ids.length)IC.selected=ids[0].image_id;
 select.value=IC.selected||'';
 $('icDownload').disabled=!IC.checks.size;$('icClearResults').disabled=!IC.checks.size;$('icClearAssignments').disabled=!IC.rows.length;$('icPrevious').disabled=!ids.length;$('icNext').disabled=!ids.length;$('icOpen').disabled=!ids.length;
 renderSelectedFields();
}
function renderSelectedFields(){const id=IC.selected,r=IC.byId.get(id),saved=IC.checks.get(id);
 $('icImageMeta').textContent=r?`${displayId(id)} · ${r.original_reviewer_id} → ${r.checker_id} · ${IC.a.length} box A`:'Chưa chọn ảnh';
 $('icCheckerId').value=r?.checker_id||'';$('icOriginalId').value=r?.original_reviewer_id||'';$('icCheckType').value=r?.check_type||'';
 $('icResult').value=saved?.result||'';$('icError').value=saved?.error_type||'';$('icResolution').value=saved?.resolution||'';$('icRevision').value=saved?.checked_revision||'';
 $('icSave').disabled=!(r&&IC.lastOpen===id&&IC.bitmap&&getA(id)&&state.manifest?.rows?.length&&!integrity().length&&!IC.parseError);
}
async function openImage(id){if(!id||!IC.byId.has(id))return;
 const token=++IC.token;IC.selected=id;if([...$('icImageSelect').options].some(o=>o.value===id))$('icImageSelect').value=id;IC.lastOpen='';IC.a=[];IC.b=[];IC.parseError='';IC.zoom=1;IC.cx=IC.cy=.5;clearBitmap();$('icSave').disabled=true;const image=getImg(id),a=getA(id),b=getB(id);
 if(!image||!a){setMessage(`Thiếu ${!image?'ảnh gốc':'nhãn A'} cho ${displayId(id)}. Không thể kết luận khi chưa có đủ dữ liệu.`,true);renderSelectedFields();draw();return;}
 try{
  IC.a=parseBoxes(a.name,typeof a.text==='string'?a.text:await a.text());if(token!==IC.token)return;
  if(b){IC.b=parseBoxes(b.name,typeof b.text==='string'?b.text:await b.text());if(token!==IC.token)return;}
  IC.bitmapUrl=URL.createObjectURL(image);const bitmap=new Image();await new Promise((ok,fail)=>{bitmap.onload=ok;bitmap.onerror=()=>fail(Error('Ảnh không mở được'));bitmap.src=IC.bitmapUrl;});if(token!==IC.token){URL.revokeObjectURL(IC.bitmapUrl);return;}IC.bitmap=bitmap;
  IC.lastOpen=id;setMessage(`Đã mở ${displayId(id)} (${IC.a.length} box A). Hãy rà soát toàn ảnh, rồi chọn kết luận của chính bạn.`);
 }catch(e){IC.parseError=e.message;setMessage(e.message,true);}renderSelectedFields();draw();
}
function validateISO(t){return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(t);}
function save(){const id=IC.selected,r=IC.byId.get(id),res=$('icResult').value,err=$('icError').value,fix=val($('icResolution').value),revision=val($('icRevision').value);
 if(!r||IC.lastOpen!==id||!IC.bitmap||IC.parseError)return setMessage('Phải mở và xem ảnh thật cùng nhãn A hợp lệ trước khi kết luận.',true);
 if(!state.manifest?.rows?.length||integrity().length)return setMessage('Thiếu hoặc sai assignment_manifest.csv; chưa thể ghi kiểm chéo.',true);
 if(!['agree','disagree'].includes(res))return setMessage('Chọn agree hoặc disagree sau khi xem ảnh.',true);
 if(res==='disagree'&&(!allowedErrors.has(err)||!fix))return setMessage('Disagree bắt buộc có error_type và resolution cụ thể.',true);
 const checkedAt=new Date().toISOString();if(!validateISO(checkedAt))return setMessage('Thời điểm kiểm tra không hợp lệ.',true);
 IC.checks.set(id,{image_id:id,checker_id:r.checker_id,original_reviewer_id:r.original_reviewer_id,result:res,error_type:res==='agree'?'':err,resolution:res==='agree'?'':fix,check_type:r.check_type,checked_revision:revision,checked_at:checkedAt,decision_id:''});
 const list=filterRows(),idx=list.findIndex(x=>x.image_id===id),pending=list.slice(idx+1).concat(list.slice(0,idx)).find(x=>!IC.checks.has(x.image_id));
 render();if($('icAutoNext').checked&&pending){void openImage(pending.image_id);setMessage(`Đã lưu ${res} · ${displayId(id)}. Chuyển sang ảnh chưa kiểm. Nhãn A không đổi.`);}
 else setMessage(`Đã lưu ${res} · ${displayId(id)} (${IC.checks.size}/${IC.rows.length}). Tải CSV để lưu bản nháp.`);
}
function download(){if(!IC.checks.size)return setMessage('Chưa có kết luận để xuất.',true);
 const rows=[...IC.checks.values()].sort((a,b)=>a.image_id.localeCompare(b.image_id));
 const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const csv='\uFEFF'+[fields.join(','),...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='crosscheck_log.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 setMessage(`Đã yêu cầu tải crosscheck_log.csv (${rows.length}/${IC.rows.length} ảnh đã kết luận). Chưa đủ ảnh thì đây là bản nháp, không phải kết quả nghiệm thu.`);
}
function show(){window.YoloIntergroup?.setScope?.('internal');render();if(IC.selected&&IC.lastOpen!==IC.selected)void openImage(IC.selected);else draw();}
function clearResults(){if(!IC.checks.size)return;if(!confirm(`Xóa ${IC.checks.size} kết luận nội bộ khỏi phiên làm việc? Hãy tải crosscheck_log.csv trước nếu cần lưu.`))return;IC.checks.clear();render();setMessage('Đã xóa kết luận nội bộ. Dữ liệu phân công, ảnh và nhãn A vẫn giữ nguyên.');}
function clearAssignments(){if(!IC.rows.length)return;if(!confirm(`Xóa ${IC.rows.length} phân công kiểm chéo nội bộ và ${IC.checks.size} kết luận đã lưu? Nhãn A/B, manifest và dữ liệu liên nhóm được giữ nguyên.`))return;IC.token++;IC.rows=[];IC.byId=new Map();IC.fileName='';IC.selected='';IC.checks.clear();IC.lastOpen='';IC.a=[];IC.b=[];IC.loaded=false;clearBitmap();render();draw();window.dispatchEvent(new CustomEvent('yolo:internal-updated'));setMessage('Đã xóa phân công nội bộ. Nạp lại crosscheck_assignments.csv tại mục 01.');}
$('icClearResults').onclick=clearResults;$('icClearAssignments').onclick=clearAssignments;
$('matchScopeInternal').addEventListener('click',show);
$('icCheckerFilter').addEventListener('change',()=>{render();if(IC.selected)void openImage(IC.selected);});
$('icStatusFilter').addEventListener('change',()=>{render();if(IC.selected)void openImage(IC.selected);});
$('icImageSelect').addEventListener('change',e=>void openImage(e.target.value));
$('icOpen').addEventListener('click',()=>{const q=val($('icSearch').value).toLowerCase();const hits=IC.rows.filter(r=>r.image_id.toLowerCase()===q||r.image_id.toLowerCase().includes(q));if(hits.length===1){$('icCheckerFilter').value='';$('icStatusFilter').value='all';render();void openImage(hits[0].image_id);}else setMessage(!hits.length?'Không tìm thấy ID thuộc danh sách kiểm chéo.':'Nhiều ID khớp, hãy nhập đủ mã ảnh.',true);});
$('icSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){$('icOpen').click();e.preventDefault();}});
for(const [button,delta] of [['icPrevious',-1],['icNext',1]])$(button).addEventListener('click',()=>{const rows=filterRows(),index=rows.findIndex(r=>r.image_id===IC.selected);if(!rows.length)return;void openImage(rows[(index+delta+rows.length)%rows.length].image_id);});
$('icFit').addEventListener('click',()=>{IC.zoom=1;IC.cx=IC.cy=.5;draw();});
$('icShowBefore').addEventListener('change',draw);$('icSave').addEventListener('click',save);$('icDownload').addEventListener('click',download);
$('icResult').addEventListener('change',()=>{if($('icResult').value==='agree'){$('icError').value='';$('icResolution').value='';}});
const canvas=$('icCanvas');canvas.addEventListener('wheel',e=>{e.preventDefault();const factor=Math.exp(-e.deltaY*.002);IC.zoom=Math.min(24,Math.max(1,IC.zoom*factor));if(IC.zoom===1)IC.cx=IC.cy=.5;draw();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(IC.zoom<=1)return;IC.drag={x:e.clientX,y:e.clientY,cx:IC.cx,cy:IC.cy};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!IC.drag||!IC.bitmap)return;const w=canvas.clientWidth,h=canvas.clientHeight,im=IC.bitmap,s=Math.min(w/im.naturalWidth,h/im.naturalHeight)*IC.zoom;IC.cx=Math.min(1,Math.max(0,IC.drag.cx-(e.clientX-IC.drag.x)/(im.naturalWidth*s)));IC.cy=Math.min(1,Math.max(0,IC.drag.cy-(e.clientY-IC.drag.y)/(im.naturalHeight*s)));draw();});
for(const evt of ['pointerup','pointercancel'])canvas.addEventListener(evt,()=>IC.drag=null);
window.addEventListener('resize',()=>{if(!$('internalCrosscheckWorkspace').hidden)draw();});
window.addEventListener('yolo:manifest-updated',()=>{if(IC.loaded){const issues=integrity();if(issues.length&&IC.checks.size){IC.checks.clear();setMessage('Manifest thay đổi: đã hủy kết luận kiểm chéo cũ để tránh ghi sai reviewer.',true);}render();}});
window.addEventListener('yolo:labels-updated',e=>{if(e.detail?.side==='after'){if(IC.checks.size){IC.checks.clear();setMessage('Nhãn A đã thay đổi: các kết luận nội bộ cũ bị hủy để phải rà soát lại ảnh.',true);}IC.lastOpen='';}if(IC.loaded)render();});
window.YoloInternalCrosscheck={ingestAssignments,render,getSummary:()=>({assigned:IC.rows.length,done:IC.checks.size,assignmentFile:IC.fileName})};
render();
})();
