/* YOLO Review Studio v4.1.9 — kiểm giữa nhóm, cùng công cụ đối chiếu nhưng tách dữ liệu. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAMES=['2-wheel vehicles','bus','car','truck'];
const IG={assignments:[],assignmentFile:'',images:new Map(),baseline:new Map(),source:new Map(),reviews:new Map(),issues:[],selected:'',group:'',scope:'main',zoom:1,cx:.5,cy:.5,view:'overlay',bitmap:null,bitmapUrl:'',drag:null,parseError:'',loadSeq:0};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const escCSV=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
const imageExt=/\.(?:png|jpe?g|webp|bmp|gif|avif)$/i;
function path(file){return String(file?._hubPath||file?.webkitRelativePath||file?.name||'').replace(/\\/g,'/');}
function normalId(fileName){let n=String(fileName).split('/').pop().replace(/\.(?:txt|png|jpe?g|webp|bmp|gif|avif)$/i,'');n=n.replace(/\.rf\.[a-zA-Z0-9_-]+$/i,'').replace(/(?:\.(?:png|jpe?g|webp|bmp)|_(?:png|jpe?g|webp|bmp))$/i,'');return n;}
function typeOf(file){const p=path(file),s=p.toLowerCase();if(/(^|\/)intergroup_assignments\.csv$/i.test(p))return 'assign';
 if(!/(^|\/)intergroup_review\//i.test(p)){if(/(^|\/)baseline_labels?\//i.test(p))return 'other';return '';} 
 if(imageExt.test(s))return 'image';
 if(/\.txt$/i.test(s)&&/(^|\/)baseline_labels?\//i.test(s))return 'baseline';
 if(/\.txt$/i.test(s)&&/(^|\/)(?:reviewed_labels?|corrected_labels?|source_labels?|after_labels?|final_labels?)\//i.test(s))return 'source';
 return 'other';}
function classify(files){const data={assign:[],image:[],baseline:[],source:[],other:[]},main=[];
 for(const f of files){const t=typeOf(f);if(t)data[t].push(f);else main.push(f);}
 return {main,data};}
// The intergroup viewer must not depend on the main B/A comparison global.
// Some offline/browser builds initialize that global later or not at all.
function parseIntergroupLabels(name,text){
 const out=[];
 String(text).replace(/^\uFEFF/,'').split(/\r?\n/).forEach((raw,index)=>{
  if(!raw.trim())return;
  const parts=raw.trim().split(/\s+/),cls=Number(parts[0]),g=parts.slice(1).map(Number);
  if(parts.length!==5||!/^[0-3]$/.test(parts[0])||!Number.isInteger(cls)||g.length!==4||g.some(x=>!Number.isFinite(x))||g[2]<=0||g[3]<=0)
   throw Error(`${name}, dòng ${index+1}: cần class ID 0–3 và 4 giá trị YOLO hữu hạn (rộng/cao > 0).`);
  out.push({line:index+1,c:cls,g,raw:raw.trim()});
 });
 return out;
}
function parseIntergroupCSV(text){
 const rows=[];let row=[],cell='',quoted=false;const input=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(cell==='')quoted=true;else throw Error('CSV có dấu ngoặc kép không hợp lệ.');}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSV thiếu dấu ngoặc kép đóng.');
 if(cell!==''||row.length){row.push(cell);if(row.some(x=>x!==''))rows.push(row);}
 if(!rows.length)throw Error('CSV trống.');
 const fields=rows.shift();if(new Set(fields).size!==fields.length)throw Error('CSV bị trùng tên cột.');
 return {fields,rows:rows.map((r,i)=>{if(r.length!==fields.length)throw Error('CSV sai số cột ở dòng '+(i+2));return Object.fromEntries(fields.map((f,j)=>[f,r[j]]));})};
}
// Same one-to-one assignment principle as B/A; intergroup comparisons are hints,
// never automatic proof of correctness against the source image.
function intergroupIoU(a,b){
 const [ax,ay,aw,ah]=a.g,[bx,by,bw,bh]=b.g;
 const left=Math.max(ax-aw/2,bx-bw/2),top=Math.max(ay-ah/2,by-bh/2);
 const right=Math.min(ax+aw/2,bx+bw/2),bottom=Math.min(ay+ah/2,by+bh/2);
 const area=Math.max(0,right-left)*Math.max(0,bottom-top);
 return area?area/(aw*ah+bw*bh-area):0;
}
function intergroupHungarian(matrix){
 if(!matrix.length||!matrix[0]?.length)return [];
 const n=matrix.length,m=matrix[0].length,full=m+n;
 const u=Array(n+1).fill(0),v=Array(full+1).fill(0),p=Array(full+1).fill(0),way=Array(full+1).fill(0);
 for(let i=1;i<=n;i++){p[0]=i;let j0=0;const minv=Array(full+1).fill(Infinity),used=Array(full+1).fill(false);
  do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=full;j++){if(used[j])continue;const cost=j<=m?-matrix[i0-1][j-1]:0,cur=cost-u[i0]-v[j];
    if(cur<minv[j]){minv[j]=cur;way[j]=j0;}if(minv[j]<delta){delta=minv[j];j1=j;}}
   for(let j=0;j<=full;j++){if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;}j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 const pairs=[];for(let j=1;j<=m;j++)if(p[j]&&matrix[p[j]-1][j-1]>0)pairs.push([p[j]-1,j-1]);return pairs;
}
function intergroupDiff(a,b,threshold=.5){
 const old=new Set(a.map((_,i)=>i)),next=new Set(b.map((_,i)=>i)),pairs=[];
 const equal=(x,y)=>x.g.every((z,i)=>Math.abs(z-y.g[i])<=1e-9);
 for(const i of [...old])for(const j of next){if(a[i].c===b[j].c&&equal(a[i],b[j])){pairs.push([i,j,1]);old.delete(i);next.delete(j);break;}}
 const ai=[...old],bi=[...next],ov=ai.map(i=>bi.map(j=>intergroupIoU(a[i],b[j])));
 for(const [i,j] of intergroupHungarian(ov.map(row=>row.map(x=>x>=threshold?x:-1)))){
  pairs.push([ai[i],bi[j],ov[i][j]]);old.delete(ai[i]);next.delete(bi[j]);
 }
 const counts={boxes_added:next.size,boxes_removed:old.size,boxes_modified:0,class_changes:0,geometry_changes:0},events=[];
 for(const [i,j,value] of pairs){const changedClass=a[i].c!==b[j].c,changedGeom=!equal(a[i],b[j]);
  if(changedClass||changedGeom){counts.boxes_modified++;counts.class_changes+=+changedClass;counts.geometry_changes+=+changedGeom;
   events.push({change_type:'modified',before_line:a[i].line,after_line:b[j].line,iou:value.toFixed(9)});}}
 for(const i of old)events.push({change_type:'removed',before_line:a[i].line,after_line:'',iou:''});
 for(const j of next)events.push({change_type:'added',before_line:'',after_line:b[j].line,iou:''});
 return {counts,events,pairs,unmatchedBefore:[...old],unmatchedAfter:[...next]};
}
function message(s,bad=false){const n=$('igMessage');if(!n)return;n.textContent=s;n.classList.toggle('igBad',bad);}
function imgOf(id){return IG.images.get(id)||null;}
function allIds(){const a=IG.assignments.length?IG.assignments.map(r=>r.image_id):[...new Set([...IG.images.keys(),...IG.baseline.keys(),...IG.source.keys()])];return [...new Set(a)].filter(Boolean);}
function rowFor(id){return IG.assignments.find(x=>x.image_id===id)||{image_id:id};}
function completeness(){const ids=allIds();return {ids,images:ids.filter(id=>IG.images.has(id)).length,base:ids.filter(id=>IG.baseline.has(id)).length,source:ids.filter(id=>IG.source.has(id)).length,checked:ids.filter(id=>IG.reviews.has(id)).length};}
async function parseAssign(file){const text=await file.text();const parsed=parseIntergroupCSV(text);const cols=parsed.fields;const get=(r,names)=>{const key=cols.find(c=>names.includes(c.toLowerCase().trim()));return key?String(r[key]||'').trim():'';};
 const ids=parsed.rows.map(r=>({image_id:get(r,['image_id','assigned_image_id','source_image_id']),source_group_id:get(r,['source_group_id','source_group','owner_group','original_group_id']),checker_group_id:get(r,['checker_group_id','checker_group','review_group_id']),checker_id:get(r,['checker_id','assigned_checker_id']),original_reviewer_id:get(r,['original_reviewer_id','source_reviewer_id']),checked_revision:get(r,['checked_revision','source_revision']),check_type:'intergroup'})).filter(r=>r.image_id);
 if(!ids.length)throw Error('intergroup_assignments.csv thiếu cột image_id hoặc không có ID hợp lệ.');
 const dup=ids.find((r,i)=>ids.findIndex(x=>x.image_id===r.image_id)!==i);if(dup)throw Error('Trùng image_id trong intergroup_assignments.csv: '+dup.image_id);
 return ids;
}
async function ingest(data){let count=0;for(const f of data.assign||[]){try{const ids=await parseAssign(f);IG.assignments=ids;IG.assignmentFile=f.name;count+=ids.length;}catch(e){IG.issues.push(e.message);}}
 for(const [role,map] of [['image',IG.images],['baseline',IG.baseline],['source',IG.source]]){
  for(const f of data[role]||[]){const id=normalId(f.name);if(!id)continue;
   if(map.has(id)&&map.get(id)!==f){IG.issues.push('Trùng '+role+' theo image_id '+id+' (đã giữ tệp đầu tiên).');continue;}
   map.set(id,f);count++;
  }
 }
 // Khi có danh sách 30 ảnh: chỉ các ID trong CSV mới là phạm vi intergroup.
 if(IG.assignments.length){const allowed=new Set(IG.assignments.map(x=>x.image_id));const unseen=[...IG.images.keys()].filter(id=>!allowed.has(id)).length;if(unseen)IG.issues.push(`${unseen} ảnh intergroup không có trong danh sách kiểm giữa nhóm; không đưa vào phạm vi kiểm.`);}
 if(!IG.selected||!allIds().includes(IG.selected))IG.selected=allIds()[0]||'';
 render();if(IG.selected)void openImage(IG.selected);window.dispatchEvent(new CustomEvent('yolo:intergroup-updated',{detail:completeness()}));
 return `Kiểm giữa nhóm: ${IG.assignments.length} ID được giao, ${IG.images.size} ảnh, ${IG.baseline.size} baseline TXT, ${IG.source.size} nhãn nhóm nguồn đã sửa`;
}
async function ingestSource(files){const seen=[];for(const f of files){if(!/\.txt$/i.test(f.name))continue;const id=normalId(f.name);if(IG.source.has(id)&&IG.source.get(id)!==f){seen.push(id);continue;}IG.source.set(id,f);}if(seen.length)IG.issues.push(`${seen.length} nhãn nhóm nguồn trùng image_id; giữ bản đã nạp trước.`);render();if(IG.selected)void openImage(IG.selected);window.dispatchEvent(new CustomEvent('yolo:intergroup-updated',{detail:completeness()}));return `Đã nhận ${files.length} nhãn nhóm nguồn (bộ kiểm giữa nhóm), chỉ dùng đối chiếu các ID được giao.`;}
// Clear only source labels for cross-group checking. Stored decisions depend on
// those labels, so discard the decisions too rather than exporting stale reviews.
function clearSource(){
 const removed=IG.source.size,invalidated=IG.reviews.size;
 if(!removed)return {removed:0,invalidated:0};
 IG.source.clear();IG.reviews.clear();IG.loadSeq++;IG.parseError='';currentSource=[];currentDiff=null;
 const ids=allIds();
 if(!ids.includes(IG.selected))IG.selected=ids[0]||'';
 if(!IG.selected){
  if(IG.bitmapUrl){URL.revokeObjectURL(IG.bitmapUrl);IG.bitmapUrl='';}
  IG.bitmap=null;
  $('igImageId').value='';$('igImageInfo').textContent='Chưa có ảnh hoặc nhãn kiểm giữa nhóm.';
  $('igDifferences').replaceChildren();$('igSave').disabled=true;
 }
 render();
 if(IG.selected)void openImage(IG.selected);else draw();
 window.dispatchEvent(new CustomEvent('yolo:intergroup-updated',{detail:completeness()}));
 message(`Đã xóa ${removed} nhãn nhóm nguồn. Nhãn A/B, ảnh và baseline không thay đổi.`
   +(invalidated?` Đã hủy ${invalidated} kết luận cũ phụ thuộc bộ nhãn này.`:''));
 return {removed,invalidated};
}
function clearRole(role){
 const maps={image:IG.images,baseline:IG.baseline,source:IG.source};
 if(role==='source')return clearSource();
 const map=maps[role],isAssign=role==='assign',isReviews=role==='reviews';
 if(!map&&!isAssign&&!isReviews)throw Error('Nhóm dữ liệu kiểm giữa nhóm không hợp lệ.');
 const removed=isAssign?IG.assignments.length:isReviews?IG.reviews.size:map.size;
 const invalidated=isReviews?0:IG.reviews.size;
 if(isAssign){IG.assignments=[];IG.assignmentFile='';}
 else if(isReviews)IG.reviews.clear();
 else map.clear();
 if(!isReviews)IG.reviews.clear();
 IG.loadSeq++;IG.parseError='';currentBase=[];currentSource=[];currentDiff=null;
 const ids=allIds();if(!ids.includes(IG.selected))IG.selected=ids[0]||'';
 if(!IG.selected){if(IG.bitmapUrl){URL.revokeObjectURL(IG.bitmapUrl);IG.bitmapUrl='';}IG.bitmap=null;$('igImageId').value='';$('igImageInfo').textContent='Chưa có dữ liệu kiểm giữa nhóm.';$('igDifferences').replaceChildren();$('igSave').disabled=true;}
 render();if(IG.selected)void openImage(IG.selected);else draw();
 window.dispatchEvent(new CustomEvent('yolo:intergroup-updated',{detail:completeness()}));
 const labels={image:'ảnh kiểm giữa nhóm',baseline:'nhãn baseline',assign:'phân công liên nhóm',reviews:'kết luận kiểm giữa nhóm'};
 message(`Đã xóa ${removed} ${labels[role]}.`+(invalidated?` Đã hủy ${invalidated} kết luận phụ thuộc dữ liệu cũ.`:''));
 return {removed,invalidated};
}
function setScope(scope){
 if(!['main','internal','intergroup'].includes(scope))scope='main';
 IG.scope=scope;
 for(const [name,workspace,button] of [['main','mainMatchWorkspace','matchScopeMain'],['internal','internalCrosscheckWorkspace','matchScopeInternal'],['intergroup','intergroupWorkspace','matchScopeInter']]){
  const active=name===scope;
  const panel=$(workspace),control=$(button);
  if(panel)panel.hidden=!active;
  if(control)control.setAttribute('aria-pressed',String(active));
 }
 const note=$('hubNeedMatch');if(note)note.hidden=scope!=='main';
 document.body.classList.toggle('intergroupMode',scope==='intergroup');
 const exportPanel=$('reviewExport');if(exportPanel)exportPanel.hidden=scope!=='main'||!state.valid;
 if(scope==='intergroup')render();
}
async function readBoxes(file){if(!file)return null;const text=await file.text();return parseIntergroupLabels(file.name,text);}
function corners(b){const [x,y,w,h]=b.g;return[x-w/2,y-h/2,x+w/2,y+h/2];}
function drawnBox(ctx,b,W,H,color,dashed,selected=false){const [x1,y1,x2,y2]=corners(b);ctx.save();ctx.strokeStyle=color;ctx.lineWidth=selected?3:1.8;ctx.setLineDash(dashed?[6,4]:[]);ctx.strokeRect(x1*W,y1*H,(x2-x1)*W,(y2-y1)*H);ctx.setLineDash([]);const caption=(dashed?'S':'BL')+b.line;ctx.font='bold 12px system-ui';const tw=ctx.measureText(caption).width+10;const px=Math.max(1,Math.min(W-tw,x1*W)),py=Math.max(15,y1*H);ctx.fillStyle=color;ctx.fillRect(px,py-15,tw,17);ctx.fillStyle='#fff';ctx.fillText(caption,px+5,py-3);ctx.restore();}
let currentBase=[],currentSource=[],currentDiff=null;
async function loadImage(id){if(IG.bitmapUrl){URL.revokeObjectURL(IG.bitmapUrl);IG.bitmapUrl='';}IG.bitmap=null;const file=imgOf(id);if(!file)return;
 const url=URL.createObjectURL(file);IG.bitmapUrl=url;const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Không mở được ảnh '+id));img.src=url;});if(IG.selected===id)IG.bitmap=img;}catch(e){message(e.message,true);}draw();}
function canvasProjection(canvas){const ctx=canvas.getContext('2d');const w=canvas.clientWidth||600,h=canvas.clientHeight||360;canvas.width=Math.max(1,Math.round(w*devicePixelRatio));canvas.height=Math.max(1,Math.round(h*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);return {ctx,w,h};}
function paint(ctx,w,h,role){ctx.fillStyle='#111d23';ctx.fillRect(0,0,w,h);if(!IG.bitmap){ctx.fillStyle='#9db0b9';ctx.font='14px system-ui';ctx.fillText('Chưa có ảnh kiểm giữa nhóm tương ứng.',20,34);return;}
 const im=IG.bitmap,fit=Math.min(w/im.naturalWidth,h/im.naturalHeight),s=fit*IG.zoom;
 const dw=im.naturalWidth*s,dh=im.naturalHeight*s,x=w/2-IG.cx*dw,y=h/2-IG.cy*dh;
 ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.drawImage(im,x,y,dw,dh);ctx.translate(x,y);ctx.scale(s,s);
 if(role!=='source')currentBase.forEach(b=>drawnBox(ctx,b,im.naturalWidth,im.naturalHeight,'#03a58f',false));
 if(role!=='baseline')currentSource.forEach(b=>drawnBox(ctx,b,im.naturalWidth,im.naturalHeight,'#ee8a3d',true));ctx.restore();}
function draw(){const view=IG.view,split=view==='split';$('igCanvasSecondary').hidden=!split;$('igCanvasPrimary').setAttribute('aria-label',split?'Ảnh với baseline':'Ảnh chồng baseline và nhãn nhóm nguồn');for(const [id,role] of [['igCanvasPrimary',split?'baseline':'both'],['igCanvasSecondary','source']]){const c=$(id);if(c.hidden)continue;const {ctx,w,h}=canvasProjection(c);paint(ctx,w,h,role);}}
async function openImage(id){if(!id||!allIds().includes(id))return;
 const seq=++IG.loadSeq;IG.selected=id;IG.parseError='';$('igSave').disabled=true;
 const baseF=IG.baseline.get(id),srcF=IG.source.get(id);currentBase=[];currentSource=[];currentDiff=null;
 try{currentBase=await readBoxes(baseF)||[];if(seq!==IG.loadSeq)return;currentSource=await readBoxes(srcF)||[];if(seq!==IG.loadSeq)return;
  if(baseF&&srcF)currentDiff=intergroupDiff(currentBase,currentSource,.50);
 }catch(e){IG.parseError=e.message;}
 if(seq!==IG.loadSeq)return;await loadImage(id);if(seq!==IG.loadSeq)return;renderSelection();
 if(IG.parseError)message('Nhãn lỗi: '+IG.parseError,true);
}
function renderSelection(){const id=IG.selected,c=completeness();$('igImageSelect').value=id;$('igImageId').value=id;
 const msg=[`Ảnh ${c.ids.indexOf(id)+1}/${c.ids.length}.`,!imgOf(id)&&'Thiếu ảnh gốc.',!IG.baseline.has(id)&&'Thiếu baseline_labels.',!IG.source.has(id)&&'Thiếu nhãn nhóm nguồn đã sửa.'].filter(Boolean).join(' ');
 $('igImageInfo').textContent=msg;const out=$('igDifferences');out.replaceChildren();if(currentDiff){
 const s=currentDiff.counts;const sum=el('div',`Đối chiếu gợi ý · Ghép ${currentDiff.pairs.length} cặp · Thêm ${s.boxes_added} · Xóa ${s.boxes_removed} · Sửa ${s.boxes_modified} · Đổi lớp ${s.class_changes}`,'igDiffSummary');out.append(sum);
 const t=el('div',undefined,'igDiffList');const items=currentDiff.events.slice(0,80);for(const e of items){const label=e.change_type==='added'?'Chỉ trong nhãn nhóm nguồn':e.change_type==='removed'?'Chỉ trong baseline':`Khác vị trí/lớp (IoU ${e.iou})`;
  t.append(el('span',`${label} · BL${e.before_line||'–'} / S${e.after_line||'–'}`,'igEvent'));}if(!items.length)t.textContent='Các box được ghép không phát hiện thay đổi; vẫn cần xem ảnh để xác nhận.';if(currentDiff.events.length>80)t.append(el('span',`Còn ${currentDiff.events.length-80} thay đổi trong dữ liệu.`,''));out.append(t);
 }else out.append(el('p',IG.source.has(id)?'Chưa có baseline: vẫn có thể xem ảnh và nhãn đã sửa của nhóm nguồn để kết luận; không có gợi ý khác biệt trước/sau.':'Chưa có nhãn đã sửa của nhóm nguồn: chưa được kết luận agree/disagree.','igHint'));
 const saved=IG.reviews.get(id);$('igResult').value=saved?.result||'';$('igErrorType').value=saved?.error_type||'';$('igResolution').value=saved?.resolution||'';$('igNotes').value=saved?.notes||'';$('igCheckedAt').value=saved?.checked_at||'';$('igCheckerId').value=saved?.checker_id||$('igCheckerId').value||'';
 $('igSave').disabled=!(imgOf(id)&&IG.source.has(id))||!!IG.parseError;$('igSave').title=IG.parseError?'Nhãn TXT không hợp lệ: '+IG.parseError:$('igSave').disabled?'Cần ảnh và nhãn đã sửa của nhóm nguồn':'';draw();}
function validateISO(s){return !s||/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s);}
function saveReview(){const id=IG.selected,result=$('igResult').value,checker=$('igCheckerId').value.trim(),at=$('igCheckedAt').value.trim(),error=$('igErrorType').value,notes=$('igNotes').value.trim(),resolution=$('igResolution').value.trim();
 if(IG.parseError)return message('Không thể lưu kết luận vì TXT không hợp lệ: '+IG.parseError,true);
 if(!imgOf(id)||!IG.source.has(id))return message('Thiếu ảnh hoặc nhãn đã sửa từ nhóm nguồn; chưa thể xác nhận kết quả.',true);
 if(!checker||!/^G\d{2}_SV\d{2}$/i.test(checker))return message('Nhập checker_id dạng G11_SV01 (đúng thành viên đang kiểm).',true);const assignedGroup=rowFor(id).checker_group_id;if(rowFor(id).original_reviewer_id&&checker.toUpperCase()===rowFor(id).original_reviewer_id.toUpperCase())return message('Người kiểm tra chéo phải khác người rà soát ban đầu.',true);if(assignedGroup&&!checker.toUpperCase().startsWith(assignedGroup.toUpperCase()+'_'))return message('checker_id không thuộc nhóm được giao kiểm ('+assignedGroup+').',true);
 if(!['agree','disagree'].includes(result))return message('Hãy xem ảnh rồi chọn agree hoặc disagree.',true);
 if(result==='disagree'&&(!error||!resolution))return message('Khi disagree, cần chọn loại lỗi và ghi phương án đề xuất sửa.',true);
 if(at&&!validateISO(at))return message('checked_at phải là ISO 8601 kèm múi giờ, hoặc để trống rồi điền trước bàn giao.',true);
 const ref=rowFor(id);IG.reviews.set(id,{image_id:id,checker_id:checker,original_reviewer_id:ref.original_reviewer_id||'',result,error_type:result==='agree'?'':error,resolution:result==='agree'?'':resolution,check_type:'intergroup',checked_revision:ref.checked_revision||'',checked_at:at,decision_id:'',notes,source_group_id:ref.source_group_id||'',checker_group_id:ref.checker_group_id||''});render();const remain=allIds().filter(x=>!IG.reviews.has(x));if($('igAutoNext')?.checked&&remain.length){const next=remain.find(x=>allIds().indexOf(x)>allIds().indexOf(id))||remain[0];void openImage(next);message(`Đã lưu ${result} cho ${id}. Đã chuyển sang ảnh chưa kiểm ${next}. Không sửa nhãn chính của nhóm nguồn.`);}else message(`Đã lưu ${result} cho ảnh ${id}. Không sửa nhãn chính của nhóm nguồn.`);}
function downloadReviews(){if(!IG.reviews.size)return message('Chưa có ảnh được kiểm giữa nhóm.',true);const fields=['image_id','checker_id','original_reviewer_id','result','error_type','resolution','check_type','checked_revision','checked_at','decision_id','notes','source_group_id','checker_group_id'];const rows=[...IG.reviews.values()].sort((a,b)=>a.image_id.localeCompare(b.image_id));const csv='\ufeff'+[fields.join(','),...rows.map(r=>fields.map(k=>escCSV(r[k])).join(','))].join('\r\n')+'\r\n';const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='crosscheck_log_intergroup_draft.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
function render(){const c=completeness(),ids=c.ids;$('igOverview').replaceChildren();const blocks=[['Được giao',c.ids.length+' ảnh'],['Ảnh gốc',c.images+'/'+ids.length],['Baseline',c.base+'/'+ids.length],['Nhãn đã sửa từ nhóm nguồn',c.source+'/'+ids.length],['Đã kiểm',c.checked+'/'+ids.length]];for(const [k,v] of blocks){const b=el('div',undefined,'igStat');b.append(el('b',v),el('span',k));$('igOverview').append(b);}
 $('igAssignmentLabel').textContent=IG.assignmentFile?`Theo ${IG.assignmentFile}: ${ids.length} image_id.`:'Chưa có intergroup_assignments.csv. Các ảnh hiển thị tạm theo ID đã nạp; chưa thể xác định đủ 30 ảnh được giao.';
 const select=$('igImageSelect'),previous=IG.selected;select.replaceChildren();for(const id of ids){const r=IG.reviews.get(id),o=el('option',`${r?'✓ ':''}${id.length>20?id.slice(0,13)+'…'+id.slice(-6):id}${!IG.source.has(id)?' · thiếu nhãn nguồn':''}`);o.value=id;select.append(o);}select.value=previous||'';
 $('igProgress').textContent=c.checked===c.ids.length&&c.ids.length?'Đã ghi nhận tất cả kết luận; vẫn cần bàn giao để nhóm nguồn quyết định sửa.':`Còn ${c.ids.length-c.checked} ảnh chưa ghi kết luận. ${IG.issues.length?'Có '+IG.issues.length+' lưu ý dữ liệu.':''}`;
 $('igDownload').disabled=!IG.reviews.size;
 if(!previous&&ids.length)IG.selected=ids[0];
 if(IG.selected&&select.value!==IG.selected)select.value=IG.selected;

 if(IG.issues.length)$('igIssues').textContent=IG.issues.slice(-4).join(' · ');
}
// Giữ tất cả thao tác kiểm giữa nhóm trong khu vực đối chiếu 04, không tạo nơi upload thứ hai.
$('matchScopeMain').addEventListener('click',()=>setScope('main'));
$('matchScopeInter').addEventListener('click',()=>setScope('intergroup'));
$('igImageSelect').onchange=e=>void openImage(e.target.value);
$('igOpen').onclick=()=>{const q=$('igImageId').value.trim().toLowerCase(),ids=allIds(),hit=ids.filter(id=>id.toLowerCase()===q||id.toLowerCase().includes(q));if(hit.length===1)void openImage(hit[0]);else message(!hit.length?'Không tìm thấy image_id trong phạm vi kiểm giữa nhóm.':'Có nhiều image_id khớp; hãy nhập thêm ký tự hoặc chọn từ danh sách.',true);};
$('igImageId').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('igOpen').click();}};
$('igPrev').onclick=()=>{const ids=allIds(),i=ids.indexOf(IG.selected);if(i>0)void openImage(ids[i-1]);};
$('igNext').onclick=()=>{const ids=allIds(),i=ids.indexOf(IG.selected);if(i<ids.length-1)void openImage(ids[i+1]);};
$('igView').onchange=e=>{IG.view=e.target.value;draw();};
$('igSave').onclick=saveReview;$('igDownload').onclick=downloadReviews;
$('igZoom').onclick=()=>{IG.zoom=IG.zoom>1?1:2;IG.cx=IG.cy=.5;draw();};
function zoom(factor){IG.zoom=Math.min(32,Math.max(1,IG.zoom*factor));if(IG.zoom===1)IG.cx=IG.cy=.5;draw();}
for(const id of ['igCanvasPrimary','igCanvasSecondary']){const c=$(id);c.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.003));},{passive:false});c.addEventListener('pointerdown',e=>{if(IG.zoom<=1)return;IG.drag={x:e.clientX,y:e.clientY,cx:IG.cx,cy:IG.cy};c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(!IG.drag||!IG.bitmap)return;const im=IG.bitmap,w=c.clientWidth,h=c.clientHeight,s=Math.min(w/im.naturalWidth,h/im.naturalHeight)*IG.zoom;IG.cx=Math.min(1,Math.max(0,IG.drag.cx-(e.clientX-IG.drag.x)/(im.naturalWidth*s)));IG.cy=Math.min(1,Math.max(0,IG.drag.cy-(e.clientY-IG.drag.y)/(im.naturalHeight*s)));draw();});c.addEventListener('pointerup',()=>IG.drag=null);c.addEventListener('pointercancel',()=>IG.drag=null);}
document.addEventListener('keydown',e=>{if(IG.scope!=='intergroup'||e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key.toLowerCase()==='z'){e.preventDefault();$('igZoom').click();}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}else if(e.key==='-'){e.preventDefault();zoom(1/1.25);}else if(e.key==='0'){e.preventDefault();IG.zoom=1;IG.cx=IG.cy=.5;draw();}});
window.addEventListener('resize',()=>{if(IG.scope==='intergroup')draw();});
window.YoloIntergroup={classify,ingest,ingestSource,clearSource,clearRole,setScope,getLoadedFileNames:()=>({source:[...IG.source.values()].map(path),baseline:[...IG.baseline.values()].map(path),image:[...IG.images.values()].map(path),assign:IG.assignmentFile?[IG.assignmentFile]:[],reviews:IG.reviews.size?['crosscheck_log_intergroup_draft.csv']:[]}),getSummary:()=>({...completeness(),sourceTotal:IG.source.size,imageTotal:IG.images.size,baselineTotal:IG.baseline.size,assignmentTotal:IG.assignments.length,reviewTotal:IG.reviews.size,assignmentFile:IG.assignmentFile,issues:IG.issues.slice()})};
render();
})();
