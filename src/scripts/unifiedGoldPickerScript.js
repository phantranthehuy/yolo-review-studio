(function(){
'use strict';
const $ = id => document.getElementById(id);
const choose=$('goldChoose'), menu=$('goldOptions'), zone=$('goldImportZone');
function closeMenu(){menu.hidden=true;choose.setAttribute('aria-expanded','false');}
choose.addEventListener('click',e=>{e.stopPropagation();const opening=menu.hidden;menu.hidden=!opening;choose.setAttribute('aria-expanded',String(opening));});
$('goldChooseFiles').addEventListener('click',()=>{closeMenu();$('goldFiles').click();});
$('goldChooseFolder').addEventListener('click',()=>{closeMenu();$('goldFolder').click();});
document.addEventListener('click',e=>{if(!e.target.closest('.goldPicker'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
async function entriesFromDirectory(dir){
 const reader=dir.createReader(), all=[];
 while(true){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;all.push(...batch);}
 const files=[];
 for(const entry of all){if(entry.isDirectory)files.push(...await entriesFromDirectory(entry));else if(entry.isFile){const f=await new Promise((resolve,reject)=>entry.file(resolve,reject));if(/\.(txt|zip)$/i.test(f.name))files.push(f);}}
 return files;
}
async function droppedFiles(items,fileList){
 const entries=Array.from(items||[]).map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
 if(!entries.some(entry=>entry.isDirectory))return Array.from(fileList||[]).filter(f=>/\.(txt|zip)$/i.test(f.name));
 const files=[];
 for(const entry of entries){if(entry.isDirectory)files.push(...await entriesFromDirectory(entry));else if(entry.isFile){const f=await new Promise((resolve,reject)=>entry.file(resolve,reject));if(/\.(txt|zip)$/i.test(f.name))files.push(f);}}
 return files;
}
for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('dragOver');});
zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('dragOver');});
zone.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('dragOver');try{const files=await droppedFiles(e.dataTransfer.items,e.dataTransfer.files);if(!files.length){$('goldCount').textContent='Không tìm thấy nhãn .txt hoặc .zip trong dữ liệu thả vào.';return;}if(window.YoloCalibration) {const input=$('goldFiles'); /* use the same parser and evaluation state as both native pickers */
   const eventLike={target:{files}};input.onchange(eventLike);
 }}catch(err){$('goldCount').textContent='Không đọc được thư mục thả vào: '+err.message;}});
})();