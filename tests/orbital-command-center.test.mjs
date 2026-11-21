import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {renderOrbitalIcon} from '../tools/render-orbital-icon.mjs';
import {SECTIONS} from '../src/core.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const required=['home','today','command','aiwork','studio','portfolio','mail','knowledge','library','approvals','settings'];

test('consistent Orbital D app icons are valid complete PNGs at all installed sizes',()=>{
 for(const size of [180,192,512]){
  const a=renderOrbitalIcon(size),b=renderOrbitalIcon(size);
  assert.deepEqual(a,b,'artwork must be deterministic');
  assert.deepEqual(a.subarray(0,8),Buffer.from('89504e470d0a1a0a','hex'));
  assert.equal(a.readUInt32BE(16),size);assert.equal(a.readUInt32BE(20),size);
  assert.equal(a[24],8);assert.equal(a[25],6,'RGBA source expected');
  assert(a.length>10000,'real raster artwork required');
 }
 assert.throws(()=>renderOrbitalIcon(170),/Unsupported/);
});

test('build renderer is the single source for the deployed icon set',()=>{
 const build=read('tools/build-hosted-shell.mjs'),source=read('src/index.html');
 assert.match(build,/writeOrbitalIcons\(fileURLToPath\(new URL\('\.\.\/hosted-dist\/icons\//);
 assert.match(source,/apple-touch-icon\.png/);
 assert.match(read('pwa/manifest.webmanifest'),/icons\/icon-512\.png/);
});

test('all top-level destinations are safe, navigable and have no second private datastore',()=>{
 const code=read('src/app.js'),css=read('src/style.css');
 assert.doesNotThrow(()=>new Script(code));
 for(const route of required)assert(SECTIONS.includes(route),'missing '+route);
 for(const route of ['studio','knowledge','library','approvals']){
  assert.match(code,new RegExp('function '+route+'\\(\\)'));
  assert.match(code,new RegExp(route+':'+route));
 }
 assert.match(code,/data-more-sections/);
 assert.match(code,/data-go="workspace"/);
 assert.match(code,/data-go="aiwork"/);
 assert.match(code,/No personal files have been uploaded or indexed automatically/);
 assert.match(code,/No counts are shown until those services return authorized evidence/);
 assert.match(code,/not a deployment/);
 assert.match(css,/\.orbital-route-layout/);
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('no shared client-side route claims that disconnected services already exist',()=>{
 const app=read('src/app.js');
 assert.match(app,/not connected in this release/);
 assert.match(app,/does not index documents or imply that a private connector is active/);
 assert.match(app,/Nothing happens behind your back/);
 assert.doesNotMatch(app,/Spotify now playing:|AI agents completed 80|12 pending approvals/);
});
