import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGen2CloudflareTarget} from '../tools/gen2-cloudflare-target.mjs';

const targetName='devon-station-rb01-isolated';
const productionName='devon-station';
const acceptanceName='devon-station-mail-acceptance';
const owner='fictional-owner@example.test';
const origin='https://devon-station-rb01-isolated.devonakins.workers.dev';
const issuer='https://synthetic-team.cloudflareaccess.com';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const text=(name,value)=>({name,type:'plain_text',text:value});
const d1=(name,n)=>({name,type:'d1',database_id:uuid(n)});
const json=name=>({name,type:'json',json:[]});
const secret=name=>({name,type:'secret_text'});
const deployment=n=>({deployments:[{id:uuid(n),versions:[{percentage:100}]}]});
const access=(aud,id,host)=>({type:'self_hosted',id:uuid(id),aud,domain:host});

function sample(){
 const aud={prod:'prod-audience',target:'isolated-audience',mail:'mail-audience'};
 const prod={
  name:productionName,deployments:deployment(21),
  settings:{bindings:[text('ACCESS_AUD',aud.prod),d1('DB',1),d1('MAIL_DB',2)]},
  accessApp:access(aud.prod,71,'ds.devonakins.com')
 };
 const mail={
  name:acceptanceName,deployments:deployment(22),
  settings:{bindings:[text('ACCESS_AUD',aud.mail),d1('DB',3),d1('MAIL_DB',4)]},
  accessApp:access(aud.mail,72,'devon-station-mail-acceptance.devonakins.workers.dev')
 };
 const flags=[
  'ASSISTANT_EVIDENCE_ENABLED','AI_WORK_ENABLED','AI_WORK_LEDGER_ENABLED',
  'MAIL_ENABLED','MAIL_DRAFTS_ENABLED','MAIL_OUTBOX_ENABLED',
  'MAIL_SEND_ENABLED','MAIL_SENDER_VERIFIED'
 ];
 const target={
  name:targetName,deployments:deployment(23),
  subdomain:{enabled:true,previews_enabled:false},
  settings:{bindings:[
   text('ACCESS_AUD',aud.target),text('ACCESS_ISSUER',issuer),
   text('ACCESS_JWKS_URL',issuer+'/cdn-cgi/access/certs'),
   text('APP_ORIGIN',origin),text('OWNER_EMAIL',owner),
   ...flags.map(n=>text(n,'false')),
   json('WORKSPACE_GRANTS'),json('WORKSPACE_PROJECT_GRANTS'),
   d1('DB',5),d1('MAIL_DB',6)
  ]},
  accessApp:access(aud.target,73,new URL(origin).hostname),
  accessPolicies:[{decision:'allow',include:[{email:{email:owner}}],exclude:[],require:[]}]
 };
 return {production:prod,mailAcceptance:mail,target,domains:[
  {hostname:'ds.devonakins.com',service:productionName}]};
}
const verify=p=>evaluateGen2CloudflareTarget(p);
const includes=(p,code)=>assert(verify(p).blockers.includes(code),code);

test('complete isolated, disabled A0 fixture can pass target checks but can NEVER authorize release',()=>{
 const result=verify(sample());
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.isolatedCandidateReady,true);
 assert.equal(result.releaseDecision,'RELEASE_NO_GO');
 assert.equal(result.mayUpload,false);
 assert.equal(result.mayDeploy,false);
 assert.equal(result.checks.independentStorage,true);
 assert.equal(result.checks.dedicatedAccess,true);
 assert.equal(result.checks.disabledExternalEffects,true);
});

test('snapshots, identities, missing settings and duplicate bindings fail closed',()=>{
 assert.deepEqual(verify(null).blockers,['snapshot_unavailable']);
 let p=sample();p.target.name='devon-station';includes(p,'worker_identity_mismatch');
 p=sample();delete p.target.settings;includes(p,'target_settings_unavailable');
 p=sample();p.target.settings.bindings.push(text('OWNER_EMAIL',owner));includes(p,'target_binding_inventory_invalid');
 p=sample();p.target.settings.bindings[0].name='../forged';includes(p,'target_binding_inventory_invalid');
 p=sample();p.target.settings.bindings.push({name:'PRIVATE_ACCESS',type:'unexpected'});includes(p,'target_binding_inventory_invalid');
 p=sample();delete p.production.settings;includes(p,'production_settings_unavailable');
});

test('D1 resources must be valid, distinct, isolated, and accounted for at all three Workers',()=>{
 let p=sample();p.target.settings.bindings.find(x=>x.name==='DB').database_id=uuid(1);
 includes(p,'isolated_d1_and_mail_d1_unverified');
 p=sample();p.target.settings.bindings.find(x=>x.name==='MAIL_DB').database_id=uuid(5);
 includes(p,'isolated_d1_and_mail_d1_unverified');
 p=sample();p.target.settings.bindings.find(x=>x.name==='MAIL_DB').database_id='not-uuid';
 includes(p,'isolated_d1_and_mail_d1_unverified');
 p=sample();p.mailAcceptance.settings.bindings=p.mailAcceptance.settings.bindings.filter(x=>x.name!=='DB');
 includes(p,'isolated_d1_and_mail_d1_unverified');
 p=sample();p.target.settings.bindings.find(x=>x.name==='DB').id=uuid(8);
 includes(p,'isolated_d1_and_mail_d1_unverified');
 p=sample();p.target.settings.bindings.find(x=>x.name==='DB').type='plain_text';
 includes(p,'isolated_d1_and_mail_d1_unverified');
});

test('missing or unsafe feature flags and provider secrets prevent independent acceptance',()=>{
 const flags=['ASSISTANT_EVIDENCE_ENABLED','AI_WORK_ENABLED','AI_WORK_LEDGER_ENABLED',
  'MAIL_ENABLED','MAIL_DRAFTS_ENABLED','MAIL_OUTBOX_ENABLED','MAIL_SEND_ENABLED',
  'MAIL_SENDER_VERIFIED'];
 for(const flag of flags){
  let p=sample();p.target.settings.bindings.find(x=>x.name===flag).text='true';
  includes(p,'unsafe_or_missing_disabled_flag_'+flag.toLowerCase());
  p=sample();p.target.settings.bindings=p.target.settings.bindings.filter(x=>x.name!==flag);
  includes(p,'unsafe_or_missing_disabled_flag_'+flag.toLowerCase());
 }
 for(const name of ['MAIL_IMAP_PASSWORD','MAIL_SMTP_PASSWORD','MAIL_PAYLOAD_KEYS_JSON',
  'GITHUB_EVIDENCE_TOKEN','VAPID_PRIVATE_JWK','OPENAI_API_KEY']){
  const p=sample();p.target.settings.bindings.push(secret(name));
  includes(p,'external_provider_secret_present_'+name.toLowerCase());
 }
});

test('Access identity, policies, JWT issuer, subject grants and isolated origin must be provable',()=>{
 let p=sample();p.target.accessApp={...p.production.accessApp};includes(p,'dedicated_access_app_unverified');
 p=sample();p.target.accessApp.aud='different';includes(p,'dedicated_access_app_unverified');
 p=sample();p.target.settings.bindings.find(b=>b.name==='ACCESS_AUD').text='prod-audience';
 includes(p,'access_audience_shared');
 p=sample();p.target.accessPolicies[0].include=[{everyone:{}}];includes(p,'access_policy_not_owner_only');
 p=sample();p.target.accessPolicies.push({...p.target.accessPolicies[0]});includes(p,'access_policy_not_owner_only');
 p=sample();p.target.accessPolicies[0].require=[{email:{email:owner}}];includes(p,'access_policy_not_owner_only');
 p=sample();p.target.settings.bindings.find(b=>b.name==='ACCESS_JWKS_URL').text='https://other.invalid/certs';
 includes(p,'access_issuer_or_jwks_unverified');
 p=sample();p.target.settings.bindings.find(b=>b.name==='ACCESS_ISSUER').text='http://insecure.test';
 includes(p,'access_issuer_or_jwks_unverified');
 p=sample();p.target.settings.bindings.find(b=>b.name==='APP_ORIGIN').text='https://ds.devonakins.com';
 includes(p,'target_origin_not_independent');
 p=sample();p.target.settings.bindings.find(b=>b.name==='WORKSPACE_GRANTS').type='plain_text';
 includes(p,'scoped_grants_not_typed_json_workspace_grants');
 p=sample();p.target.settings.bindings.find(b=>b.name==='WORKSPACE_PROJECT_GRANTS').type='plain_text';
 includes(p,'scoped_grants_not_typed_json_workspace_project_grants');
});

test('deployed target anchor and route/preview isolation must be observed',()=>{
 let p=sample();p.target.deployments.deployments[0].id='missing';includes(p,'deployment_anchor_unavailable_or_shared');
 p=sample();p.target.deployments.deployments[0].id=uuid(21);includes(p,'deployment_anchor_unavailable_or_shared');
 p=sample();p.target.subdomain.previews_enabled=true;includes(p,'isolated_subdomain_or_preview_unverified');
 p=sample();p.target.subdomain.enabled=false;includes(p,'isolated_subdomain_or_preview_unverified');
 p=sample();p.domains.push({hostname:'something.devonakins.com',service:targetName});
 includes(p,'unsafe_or_unverified_custom_domain_route');
 p=sample();p.domains=[];includes(p,'unsafe_or_unverified_custom_domain_route');
 p=sample();delete p.domains;includes(p,'domain_inventory_unavailable');
});

test('returned evaluation does not expose any private owner, origin, identity, secret or D1 ID',()=>{
 const p=sample();
 p.target.settings.bindings.push(secret('GITHUB_EVIDENCE_TOKEN'));
 const result=verify(p),serialized=JSON.stringify(result);
 assert.equal(result.releaseDecision,'RELEASE_NO_GO');
 assert.equal(result.isolatedCandidateReady,false);
 assert(!serialized.includes(owner));
 assert(!serialized.includes(issuer));
 assert(!serialized.includes(origin));
 for(let n=1;n<=6;n++)assert(!serialized.includes(uuid(n)));
 assert(!serialized.includes('prod-audience'));
 assert.deepEqual(Object.keys(result).sort(),['blockers','checks','isolatedCandidateReady',
  'mayDeploy','mayUpload','mode','releaseDecision','reportVersion','target'].sort());
});
