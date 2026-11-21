/**
 * Dadog Core — public-safe owner-guided operating contract.
 *
 * This is deterministic local presentation, not a model, persistent memory,
 * delegated authority, or a new task database. The existing owner-scoped
 * capture/Today state remains the only source of personal focus.
 */
export const DADOG_CORE_CONTRACT=Object.freeze({
  product:'Dadog',
  scope:'personal-owner',
  nextActionSource:'owner-selected-focus',
  autonomousExecution:false,
  modelConnection:false,
  privateKnowledgeConnection:false,
  requiresExplicitApproval:true,
});

export function dadogCoreSnapshot(focused){
  const selected=Array.isArray(focused)?focused.slice(0,3):[];
  const first=selected[0];
  const nextAction=first&&typeof first.title==='string'&&first.title.trim()
    ?Object.freeze({
       title:first.title,
       area:typeof first.area==='string'?first.area:'',
       source:'owner-selected-focus'
     }):null;
  return Object.freeze({
    product:DADOG_CORE_CONTRACT.product,
    nextAction,
    selectedCount:selected.length,
    source:'existing-local-captures',
    modelConnected:false,
    canExecute:false
  });
}
