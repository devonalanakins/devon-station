import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGen2Review,GEN2_MODULES,GEN2_ASSETS} from '../tools/prepare-gen2-review.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sourceCommit='a'.repeat(40);

function fixture(){
 const sourceModules=Object.fromEntries(GEN2_MODULES.filter(n=>n!=='index.mjs').map(n=>[n,source(n)]));
 const assetFiles=Object.fromEntries(GEN2_ASSETS.map(name=>[name,Buffer.from(
  name==='/LICENSE.txt'?'GNU AFFERO GENERAL PUBLIC LICENSE':
  name==='/index.html'?'<main>synthetic review only "privateDataLoaded":false</main>':
  name.endsWith('.png')?'synthetic png bytes':name
 )]));
 const assets=Object.fromEntries(GEN2_ASSETS.map(name=>[name,{
  type:name==='/LICENSE.txt'?'text/plain;charset=utf-8':name.endsWith('.png')?'image/png':
   name.endsWith('.webmanifest')?'application/manifest+json;charset=utf-8':
   name.endsWith('.js')?'text/javascript;charset=utf-8':'text/html;charset=utf-8',
  encoding:name.endsWith('.png')?'base64':'utf8',
  body:Buffer.from(assetFiles[name]).toString(name.endsWith('.png')?'base64':'utf8')
 }]));
 const entry="import {connect} from 'cloudflare:sockets';\n"+
  "import {createStation} from './worker/index.mjs';\n"+
  "const assets="+JSON.stringify(assets)+";\n"+
  "export default createStation(assets,undefined,undefined,connect);\n";
 const candidate={'index.mjs':entry,...sourceModules};
 return {candidate,sourceModules,assetFiles,sourceCommit};
}
const build=f=>createGen2Review(f);
test('Generation 2 review has fixed, distinct source and hosted asset inventories',()=>{
 assert.equal(GEN2_MODULES.length,48);
 assert.equal(new Set(GEN2_MODULES).size,48);
 assert.equal(GEN2_ASSETS.length,7);
 assert.equal(new Set(GEN2_ASSETS).size,7);
});
test('pure review bytes, provenance and checksums are deterministic and never imply a release',()=>{
 const first=build(fixture()),second=build(fixture());
 assert.deepEqual(first.files,second.files);
 assert.deepEqual(first.manifest,second.manifest);
 assert.equal(first.manifest.sourceCommit,sourceCommit);
 assert.equal(first.manifest.status,'SOURCE_REVIEW_ONLY_NEVER_UPLOAD');
 assert.equal(first.manifest.uploadAuthorized,false);
 assert.equal(first.manifest.mergeAuthorized,false);
 assert.equal(first.manifest.productionVerified,false);
 assert.equal(first.manifest.candidate.moduleCount,48);
 assert.equal(first.manifest.candidate.assetCount,7);
 assert.equal(first.manifest.candidate.sha256,sha(first.files['candidate.modules.json']));
 assert.equal(sha(first.files['manifest.json']),first.files.SHA256SUMS.trim().split('\n')[1].slice(0,64));
 for(const line of first.files.SHA256SUMS.trim().split('\n')){
  const match=/^([a-f0-9]{64})  ([a-z0-9.-]+)$/.exec(line);
  assert(match);assert.equal(match[1],sha(first.files[match[2]]));
 }
 assert.equal(Object.keys(JSON.parse(first.files['candidate.modules.json'])).length,48);
});
test('source review refuses missing, extra or tampered code regardless of a self-consistent candidate',()=>{
 const cases=[
  f=>{delete f.candidate['worker/assistant-evidence.mjs'];},
  f=>{f.candidate['extra.mjs']='fake';},
  f=>{f.candidate['worker/ai-work-api.mjs']+='// edited';},
  f=>{f.sourceModules['worker/ai-work-api.mjs']+='// edited';},
  f=>{f.candidate['worker/access.mjs']+='// weaker auth';f.sourceModules['worker/access.mjs']+='// weaker auth';},
  f=>{f.candidate['worker/index.mjs']=f.sourceModules['worker/index.mjs']='// forged source';},
  f=>{f.candidate['worker/assistant-evidence.mjs']=f.sourceModules['worker/assistant-evidence.mjs']='no feature flag';},
 ];
 for(const edit of cases){const f=fixture();edit(f);assert.throws(()=>build(f),/Generation 2 review refused/);}
});
test('entrypoint provenance and hosted bytes cannot be replaced or silently expanded',()=>{
 const cases=[
  f=>{f.candidate['index.mjs']+="export const extra=true;\n";},
  f=>{delete f.assetFiles['/sw.js'];},
  f=>{f.assetFiles['/extra.js']=Buffer.from('new');},
  f=>{f.assetFiles['/index.html']=Buffer.from('changed');},
  f=>{const key='/icons/icon-192.png';f.assetFiles[key]=Buffer.from('forged');},
  f=>{const key='/manifest.webmanifest';f.assetFiles[key]=Buffer.from('different');},
  f=>{f.candidate['index.mjs']=f.candidate['index.mjs'].replace('cloudflare:sockets','other:host');},
 ];
 for(const edit of cases){const f=fixture();edit(f);assert.throws(()=>build(f),/Generation 2 review refused/);}
});
test('private marker, token-shaped content, malformed SHA and invalid source data fail closed',()=>{
 const variants=[
  f=>{f.sourceCommit='b'.repeat(39);},
  f=>{f.sourceModules['worker/portfolio.mjs']=f.candidate['worker/portfolio.mjs']=
   'const secret="ghp_'+ '012345678901234567890123456789' + '";';},
  f=>{f.sourceModules['worker/portfolio.mjs']=f.candidate['worker/portfolio.mjs']=
   'const data={"privateDataLoaded":true};';},
  f=>{f.candidate=null;},
  f=>{f.sourceModules=null;},
  f=>{f.assetFiles['/index.html']='not bytes';},
 ];
 for(const edit of variants){const f=fixture();edit(f);assert.throws(()=>build(f),/Generation 2 review refused/);}
});
