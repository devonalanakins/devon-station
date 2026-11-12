/** Reproducible, source-only Gen2 review package. NEVER an uploader or deployment authority. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verifiedSourceCommit} from './prepare-rb01-review.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const SHA=/^[0-9a-f]{40}$/;
const ACCESS_SHA256='1f3127c82f2079f82685f8f4ee56a82c390cf36dd7ef36273b4623e9ab3c9654';
export const GEN2_MODULES=Object.freeze([
 'index.mjs','worker/index.mjs','worker/access.mjs',
 'worker/notifications.mjs','worker/state.mjs','worker/portfolio.mjs',
 'worker/workspace.mjs','worker/workspace-journal.mjs',
 'foundation/src/foundation.mjs','foundation/src/access-scope-bridge.mjs',
 'foundation/interop/approved-portfolio.mjs','src/workspace-backup.mjs',
 'worker/ai-work-execution.mjs','worker/ai-work-api.mjs',
 'worker/assistant-evidence.mjs','src/assistant-commands.mjs',
  'worker/personal-calendar-read.mjs',
 'worker/mail-api.mjs','worker/mail-drafts-api.mjs','worker/mail-outbox-api.mjs',
 ...['mail-onboarding.mjs','mail-core.mjs','mail-readonly-service.mjs',
  'mail-imap-readonly.mjs','mail-imap-transport.mjs','mail-mime-text.mjs',
  'mail-d1-store.mjs','mail-sqlite-store.mjs','mail-mime-safe.mjs',
  'mail-drafts.mjs','mail-outbound-wire.mjs','mail-smtp-transport.mjs',
  'mail-outbox.mjs','mail-payload-crypto.mjs','mail-sent-evidence.mjs'].map(n=>'src/communications/'+n),
 ...['address-parser.mjs','base64-decoder.mjs','base64-encoder.mjs','chunk-writer.mjs',
  'decode-strings.mjs','errors.mjs','html-entities.mjs','mime-node.mjs',
  'otp-token.mjs','pass-through-decoder.mjs','postal-mime.mjs',
  'qp-decoder.mjs','text-format.mjs','types.mjs'].map(n=>'vendor/postal-mime/'+n)
]);
export const GEN2_ASSETS=Object.freeze([
 '/LICENSE.txt','/index.html','/manifest.webmanifest','/sw.js',
 '/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png'
]);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=reason=>{throw Error('Generation 2 review refused: '+reason);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const sameKeys=(data,expected)=>object(data)&&Object.keys(data).length===expected.length&&
 expected.every(key=>Object.hasOwn(data,key));
const stringify=data=>JSON.stringify(data,null,2)+'\n';
const sourceOnly=bytes=>{
 const text=typeof bytes==='string'?bytes:Buffer.from(bytes).toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)||
    /(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{20,}/.test(text)||
    /https?:\/\/app\.notion\.com\/p\/[a-f0-9]{32}/i.test(text)||
    /"privateDataLoaded"\s*:\s*true/.test(text))refuse('private data or secret-shaped material in candidate');
};
/**
 * Pure, adversarially testable source-to-artifact verifier.
 * sourceModules are bytes read from this exact Git-tracked checkout (not artifacts).
 * assetFiles are bytes read from the freshly generated hosted-dist (not artifacts).
 */
export function createGen2Review({candidate,sourceCommit,sourceModules,assetFiles}){
 if(!SHA.test(sourceCommit))refuse('unverified source commit');
 if(GEN2_MODULES.length!==49||new Set(GEN2_MODULES).size!==49)refuse('pinned module inventory invalid');
 if(!sameKeys(candidate,GEN2_MODULES)||!sameKeys(sourceModules,GEN2_MODULES.filter(x=>x!=='index.mjs')))
  refuse('unexpected or incomplete module inventory');
 if(!sameKeys(assetFiles,GEN2_ASSETS))refuse('unexpected or incomplete assets');
 for(const name of GEN2_MODULES.filter(x=>x!=='index.mjs')){
  if(typeof candidate[name]!=='string'||typeof sourceModules[name]!=='string'||candidate[name]!==sourceModules[name])
   refuse('module bytes differ from source: '+name);
  sourceOnly(candidate[name]);
 }
 if(sha256(candidate['worker/access.mjs'])!==ACCESS_SHA256)refuse('reviewed Access implementation changed');
 if(!candidate['worker/index.mjs'].includes("'/api/assistant/'")||
    !candidate['worker/assistant-evidence.mjs'].includes("ASSISTANT_EVIDENCE_ENABLED")||
    !candidate['worker/assistant-evidence.mjs'].includes("parseAssistantCommand"))
  refuse('read-only Assistant route or authorization source missing');
  if(!candidate['worker/index.mjs'].includes("'/api/calendar/'")||
     !candidate['worker/personal-calendar-read.mjs'].includes('PERSONAL_CALENDAR_APPROVED')||
     !candidate['worker/personal-calendar-read.mjs'].includes('PERSONAL_CALENDAR_OWNER_SUB'))
    refuse('read-only personal calendar scope or owner gate missing');
 const entry=candidate['index.mjs'];
 if(typeof entry!=='string')refuse('Worker entry is not text');
 const match=entry.match(/^import \{connect\} from 'cloudflare:sockets';\nimport \{createStation\} from '\.\/worker\/index\.mjs';\nconst assets=(\{[^\n]*\});\nexport default createStation\(assets,undefined,undefined,connect\);\n$/);
 if(!match)refuse('unexpected Worker entry or upload template');
 let assets;try{assets=JSON.parse(match[1]);}catch{refuse('invalid hosted asset entry');}
 if(!sameKeys(assets,GEN2_ASSETS))refuse('hosted asset inventory changed');
 const assetsSha256={};
 for(const name of GEN2_ASSETS){
  const item=assets[name],bytes=assetFiles[name];
  const binary=name.endsWith('.png');
  if(!object(item)||Object.keys(item).sort().join(',')!=='body,encoding,type'||
     typeof item.body!=='string'||typeof item.type!=='string'||!(bytes instanceof Uint8Array)||
     item.encoding!==(binary?'base64':'utf8'))refuse('unexpected asset metadata: '+name);
  const decoded=Buffer.from(item.body,item.encoding);
  if(binary&&decoded.toString('base64')!==item.body)refuse('noncanonical binary asset: '+name);
  if(!decoded.equals(Buffer.from(bytes)))refuse('hosted asset differs from built bytes: '+name);
  if(name==='/index.html'){
   if(!item.body.includes('"privateDataLoaded":false'))refuse('private-data-disabled marker absent');
   sourceOnly(item.body);
  }
  assetsSha256[name]=sha256(bytes);
 }
 sourceOnly(entry);
 const candidateText=stringify(candidate);
 const manifest={
  schemaVersion:1,status:'SOURCE_REVIEW_ONLY_NEVER_UPLOAD',
  scope:'DevonStation Gen2 A0 Assistant + Project Evidence',
  license:'AGPL-3.0-only',
  sourceCommit,sourceRepository:'devonalanakins/devon-station',
  sourceCheck:'clean Git-tracked checkout, exact blobs, before and after rebuild',
  build:'tools/build-hosted-shell.mjs + tools/build-worker.mjs --shell + tools/verify-public-source.mjs',
  uploadAuthorized:false,mergeAuthorized:false,productionVerified:false,
  identityAndData:'UNASSIGNED; approval and independent recovery/restore verification outstanding',
  candidate:{
   file:'candidate.modules.json',sha256:sha256(candidateText),
   moduleCount:GEN2_MODULES.length,assetCount:GEN2_ASSETS.length,
   moduleDigests:Object.fromEntries(GEN2_MODULES.map(n=>[n,sha256(candidate[n])])),
   assetDigests:assetsSha256
  }
 };
 const manifestText=stringify(manifest);
 return {manifest,files:{
  'candidate.modules.json':candidateText,
  'manifest.json':manifestText,
  SHA256SUMS:sha256(candidateText)+'  candidate.modules.json\n'+sha256(manifestText)+'  manifest.json\n'
 }};
}
async function main(){
 const sourceCommit=await verifiedSourceCommit();
 // Rebuild ignored files exclusively from the verified checkout. No provider API calls.
 for(const [script,flag] of [['build-hosted-shell.mjs',null],['build-worker.mjs','--shell'],['verify-public-source.mjs',null]]){
  execFileSync(process.execPath,[join(root,'tools',script),...(flag?[flag]:[])],
   {cwd:root,stdio:['ignore','pipe','pipe']});
 }
 const candidate=JSON.parse(await readFile(join(root,'deployment/modules.json'),'utf8'));
 const sourceModules={};
 for(const name of GEN2_MODULES.filter(x=>x!=='index.mjs'))
  sourceModules[name]=await readFile(join(root,name),'utf8');
 const assetFiles={};
 for(const name of GEN2_ASSETS)
  assetFiles[name]=await readFile(join(root,'hosted-dist',name.slice(1)));
 const {files,manifest}=createGen2Review({candidate,sourceCommit,sourceModules,assetFiles});
 if(await verifiedSourceCommit()!==sourceCommit)refuse('source changed during review build');
 const destination=join(root,'release-review','gen2');
 await mkdir(destination,{recursive:true});
 for(const [name,contents] of Object.entries(files))
  await writeFile(join(destination,name),contents,{flag:'w'});
 console.log('Generation 2 SOURCE-ONLY review. Git commit '+sourceCommit);
 console.log('49 module source-only candidate SHA-256 '+manifest.candidate.sha256);
 console.log('No uploader, credentials, deployment, merge, migration, fallback switch or production authority.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 await main();
