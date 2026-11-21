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

/**
 * Deterministic, read-only context for up to three existing owner-selected items.
 * Plan dates are owner-entered planning hints, NOT confirmed external deadlines.
 * No model request, private data copy, network call or persistent storage.
 */
export function dadogPlanningContext(focused,referenceDay){
  const civilDay=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const parsed=new Date(value+'T00:00:00Z');
    return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
  };
  const day=civilDay(referenceDay);
  const selected=Array.isArray(focused)?focused.slice(0,3):[];
  let plannedToday=0,plannedEarlier=0,plannedLater=0,undated=0,unverifiedDate=0;
  for(const item of selected){
    const raw=item?.planDate;
    if(raw==null||raw===''){undated++;continue;}
    const plan=civilDay(raw);
    if(!plan||!day){unverifiedDate++;continue;}
    if(plan===day)plannedToday++;
    else if(plan<day)plannedEarlier++;
    else plannedLater++;
  }
  return Object.freeze({
    source:'existing-owner-selected-focus',
    referenceDay:day,
    selectedCount:selected.length,
    plannedToday,
    plannedEarlier,
    plannedLater,
    undated,
    unverifiedDate,
    inferredDeadlines:false,
    automaticPriority:false,
    canExecute:false
  });
}
