(function(){
 'use strict';
 // Put the mobile information footer directly under <body> to escape the
 // transformed right toolbar and any clipping/stacking contexts in the canvas.
 const info=document.getElementById('coordMobileInfoBar');
 if(info&&info.parentElement!==document.body)document.body.appendChild(info);
 // Ensure the right-side toolbar remains exclusively controlled by its own mode.
 // Desktop controls still live in the viewport-bottom strip.
})();