(function(){
 const selected=document.getElementById('coord_selectionInfo'),raw=document.getElementById('coord_raw'),status=document.getElementById('coord_status'),menu=document.getElementById('coord_moreMenu');
 if(!selected||!raw||!status||!menu)return;
 const details=document.createElement('div');details.id='coord_moreContext';details.className='coordMoreContext';details.hidden=true;
 menu.append(details);
 function refresh(){
   const lines=[raw.textContent.trim(),status.textContent.trim()].filter(Boolean);
   details.textContent=lines.join('\n');details.hidden=!lines.length;
   selected.title=lines.join(' — ');
 }
 new MutationObserver(refresh).observe(raw,{childList:true,characterData:true,subtree:true});
 new MutationObserver(refresh).observe(status,{childList:true,characterData:true,subtree:true});
 refresh();
})();