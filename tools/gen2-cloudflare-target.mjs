/**
 * Cloudflare Worker acceptance-target preflight for DS011 Generation 2.
 *
 * Read-only pure policy. Never uploads, deploys, changes grants, or reports
 * release authorization. Inputs are private provider snapshots, NOT files to
 * write to GitHub/CI. Output is limited to non-identifying blocker codes.
 */
const TARGET='devon-station-rb01-isolated';
const PRODUCTION='devon-station';
const MAIL_ACCEPTANCE='devon-station-mail-acceptance';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRING_FLAGS=Object.freeze([
 'ASSISTANT_EVIDENCE_ENABLED','AI_WORK_ENABLED','AI_WORK_LEDGER_ENABLED',
 'MAIL_ENABLED','MAIL_DRAFTS_ENABLED','MAIL_OUTBOX_ENABLED',
 'MAIL_SEND_ENABLED','MAIL_SENDER_VERIFIED'
]);
const ACCESS_TEXT=Object.freeze([
 'ACCESS_AUD','ACCESS_ISSUER','ACCESS_JWKS_URL','APP_ORIGIN','OWNER_EMAIL'
]);
const NO_REAL_PROVIDER_SECRETS=new Set([
 'MAIL_IMAP_PASSWORD','MAIL_SMTP_PASSWORD','MAIL_PAYLOAD_KEYS_JSON',
 'GITHUB_EVIDENCE_TOKEN','VAPID_PRIVATE_JWK','NOTION_READ_TOKEN',
 'AI_MODEL_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY'
]);
const NAME=/^[A-Z][A-Z0-9_]{1,64}$/;
const asArray=x=>Array.isArray(x)?x:null;
const unique=x=>[...new Set(x)];
const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
const collectBindings=(settings,code,blockers)=>{
 const bindings=asArray(settings?.bindings);
 if(!bindings){blockers.push(code+'_settings_unavailable');return null;}
 const output=new Map();
 for(const b of bindings){
  if(!b||typeof b.name!=='string'||!NAME.test(b.name)||output.has(b.name)||
     !['plain_text','secret_text','d1','json','version_metadata'].includes(b.type)){
   blockers.push(code+'_binding_inventory_invalid');return null;
  }
  output.set(b.name,b);
 }
 return output;
};
const getText=(bindings,name)=>{
 const b=bindings?.get(name);
 return b?.type==='plain_text'&&typeof b.text==='string'?b.text:null;
};
const getD1=(bindings,name)=>{
 const b=bindings?.get(name),id=b?.database_id??b?.id;
 return b?.type==='d1'&&typeof id==='string'&&UUID.test(id)&&
   (!b.id||!b.database_id||b.id===b.database_id)?id:null;
};
const deploymentId=dep=>{
 const all=asArray(dep?.deployments);
 return all&&all.length&&UUID.test(all[0]?.id)?all[0].id:null;
};
const validUrlOrigin=x=>{
 try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&
  !u.pathname.replaceAll('/','')&&!u.search&&!u.hash&&u.origin===x?u:null;}
 catch{return null;}
};
const policyValid=(policy,owner)=>{
 const include=asArray(policy?.include);
 return policy?.decision==='allow'&&include?.length===1&&
  include[0]?.email?.email===owner&&
  asArray(policy.exclude)?.length===0&&
  asArray(policy.require)?.length===0;
};
/**
 * @param snapshot - private provider data. Never return it, even on failure.
 * @returns only sanitized, stable blocker identifiers and boolean checks.
 */
export function evaluateGen2CloudflareTarget(snapshot){
 const blockers=[];
 const none={
  reportVersion:1,target:TARGET,mode:'READ_ONLY_TARGET_INSPECTION',
  blockers:[],checks:{},isolatedCandidateReady:false,
  releaseDecision:'RELEASE_NO_GO',mayUpload:false,mayDeploy:false
 };
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
  return {...none,blockers:['snapshot_unavailable']};
 const production=snapshot.production,stage=snapshot.target,mail=snapshot.mailAcceptance;
 if(production?.name!==PRODUCTION||stage?.name!==TARGET||mail?.name!==MAIL_ACCEPTANCE)
  blockers.push('worker_identity_mismatch');
 const prodBindings=collectBindings(production?.settings,'production',blockers);
 const targetBindings=collectBindings(stage?.settings,'target',blockers);
 const mailBindings=collectBindings(mail?.settings,'mail_acceptance',blockers);
 if(!prodBindings||!targetBindings||!mailBindings)
  return {...none,blockers:unique(blockers)};
 const prodDeploy=deploymentId(production.deployments);
 const targetDeploy=deploymentId(stage.deployments);
 const mailDeploy=deploymentId(mail.deployments);
 if(!prodDeploy||!targetDeploy||!mailDeploy||new Set([prodDeploy,targetDeploy,mailDeploy]).size!==3)
  blockers.push('deployment_anchor_unavailable_or_shared');
 if(stage.subdomain?.enabled!==true||stage.subdomain?.previews_enabled!==false)
  blockers.push('isolated_subdomain_or_preview_unverified');
 const domains=asArray(snapshot.domains);
 if(!domains)blockers.push('domain_inventory_unavailable');
 else if(domains.some(d=>d?.service===TARGET||d?.service===MAIL_ACCEPTANCE&&
    d?.hostname==='ds.devonakins.com')||
    !domains.some(d=>d?.hostname==='ds.devonakins.com'&&d?.service===PRODUCTION))
  blockers.push('unsafe_or_unverified_custom_domain_route');
 const owner=getText(targetBindings,'OWNER_EMAIL');
 const origin=getText(targetBindings,'APP_ORIGIN'),originUrl=validUrlOrigin(origin);
 const aud=getText(targetBindings,'ACCESS_AUD');
 const issuer=getText(targetBindings,'ACCESS_ISSUER');
 const jwks=getText(targetBindings,'ACCESS_JWKS_URL');
 for(const name of ACCESS_TEXT){
  if(!getText(targetBindings,name))blockers.push('required_access_setting_missing_'+name.toLowerCase());
 }
 if(!originUrl||originUrl.hostname!=='devon-station-rb01-isolated.devonakins.workers.dev')
  blockers.push('target_origin_not_independent');
 if(!issuer?.startsWith('https://')||validUrlOrigin(issuer)===null||
    jwks!==issuer+'/cdn-cgi/access/certs')
  blockers.push('access_issuer_or_jwks_unverified');
 if(aud&&(aud===getText(prodBindings,'ACCESS_AUD')||
    aud===getText(mailBindings,'ACCESS_AUD')))
  blockers.push('access_audience_shared');
 const app=stage.accessApp,prodApp=production.accessApp,mailApp=mail.accessApp;
 if(app?.type!=='self_hosted'||app?.aud!==aud||app?.domain!==originUrl?.hostname||
    !app.id||app.id===prodApp?.id||app.id===mailApp?.id)
  blockers.push('dedicated_access_app_unverified');
 const policies=asArray(stage.accessPolicies);
 if(!owner||!policies||policies.length!==1||!policyValid(policies[0],owner))
  blockers.push('access_policy_not_owner_only');
 for(const name of ['WORKSPACE_GRANTS','WORKSPACE_PROJECT_GRANTS']){
  if(targetBindings.get(name)?.type!=='json')
   blockers.push('scoped_grants_not_typed_json_'+name.toLowerCase());
 }
 for(const name of STRING_FLAGS){
  if(getText(targetBindings,name)!=='false')
   blockers.push('unsafe_or_missing_disabled_flag_'+name.toLowerCase());
 }
 for(const name of NO_REAL_PROVIDER_SECRETS){
  if(targetBindings.has(name))blockers.push('external_provider_secret_present_'+name.toLowerCase());
 }
 // No data migration or privileged mail acceptance is allowed into this
 // initial read-only A0 candidate. Both DBs must exist and be isolated.
 const a=getD1(targetBindings,'DB'),b=getD1(targetBindings,'MAIL_DB');
 const upstream=[getD1(prodBindings,'DB'),getD1(prodBindings,'MAIL_DB'),
  getD1(mailBindings,'DB'),getD1(mailBindings,'MAIL_DB')];
 if(!a||!b||a===b||upstream.some(id=>!id)||[a,b].some(id=>upstream.includes(id)))
  blockers.push('isolated_d1_and_mail_d1_unverified');
 return {
  ...none,blockers:unique(blockers),
  checks:{
   identity:!blockers.includes('worker_identity_mismatch'),
   independentStorage:!blockers.includes('isolated_d1_and_mail_d1_unverified'),
   dedicatedAccess:!blockers.some(x=>x.includes('access_')||x.includes('required_access_')),
   disabledExternalEffects:!blockers.some(x=>x.startsWith('unsafe_or_missing_disabled_flag_')||
     x.startsWith('external_provider_secret_present_')),
   productionRouteUnchanged:!blockers.includes('unsafe_or_unverified_custom_domain_route')
  },
  // Passing this screen is necessary, never sufficient: exact-head uploader,
  // owner authorization, physical-device checks and recovery remain separate.
  isolatedCandidateReady:blockers.length===0
 };
}
