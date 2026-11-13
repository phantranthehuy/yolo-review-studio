(function(){
 'use strict';

 function hasSessionData(){
  if(state.busy||state.before.length||state.after.length||state.gold.length||
   state.manifest||state.schema||state.evalIds||state.evaluation||state.prepared||
   state.valid||state.matchReviews.size)return true;

  if(window.YoloUploadHub?.isLoading?.()||
   window.MatchReview?.listImageIds?.()?.length||
   window.MatchReview?.listAfterImageIds?.()?.length||
   window.YoloCoords?.hasSessionData?.()||
   window.YoloMerge?.getMembers?.()?.size||
   window.YoloAllocation?.hasSessionData?.())return true;

  const internal=window.YoloInternalCrosscheck?.getSummary?.();
  if(internal?.assignmentFile||internal?.assigned||internal?.done)return true;
  const intergroup=window.YoloIntergroup?.getSummary?.();
  if(intergroup?.sourceTotal||intergroup?.imageTotal||intergroup?.baselineTotal||
   intergroup?.assignmentTotal||intergroup?.assignmentFile||intergroup?.reviewTotal)return true;

  if(document.getElementById('coord_quick')?.value.trim())return true;
  return Array.from(document.querySelectorAll('#configSection input:not([type="file"])')).some(input=>
   input.type==='checkbox'?input.checked!==input.defaultChecked:input.value!==input.defaultValue
  );
 }

 window.addEventListener('beforeunload',event=>{
  if(!hasSessionData())return;
  event.preventDefault();
  event.returnValue=true;
 });
})();
