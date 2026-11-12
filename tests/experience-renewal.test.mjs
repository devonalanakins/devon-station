import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const luminance = hex => {
 const v = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
   .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
 return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
};
const contrast = (a,b) => {
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
};

test('identity candidate remains a source-only, reviewable vector asset',()=>{
 const svg=source('pwa/icons/devonstation-orbital-d-candidate.svg');
 assert.match(svg,/viewBox="0 0 512 512"/);
 assert.match(svg,/aria-label="DevonStation orbital D icon"/);
 assert.match(svg,/<path d="M170 157H233/);
 assert.doesNotMatch(svg,/<script\b|onload=|href="https?:/i);
 assert.match(source('docs/DS011-EXPERIENCE-RENEWAL-IDENTITY-01.md'),/DRAFT, source-only candidate/);
});

test('in-app mark is accessible, consistent and introduces no external asset dependency',()=>{
 const html=source('src/index.html');
 assert.match(html,/aria-label="DevonStation home"/);
 assert.match(html,/viewBox="0 0 512 512" aria-hidden="true"/);
 assert.match(html,/id="ds-signal"/);
 assert.match(html,/<title>DevonStation<\/title>/);
 assert.match(html,/href="#view">Skip to workspace/);
 const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
 assert.ok(policy);
 assert.match(policy,/default-src 'none'/);
 assert.match(policy,/worker-src 'self'/);
 assert.match(policy,/connect-src 'none'/);
 assert.doesNotMatch(html,/fonts\.googleapis\.com|@import\s+url/);
});

test('PWA naming and theme are consistent while raster icons remain separately gated',()=>{
 const manifest=JSON.parse(source('pwa/manifest.webmanifest'));
 assert.equal(manifest.name,'DevonStation');
 assert.equal(manifest.short_name,'DevonStation');
 assert.equal(manifest.theme_color,'#070c17');
 assert.equal(manifest.background_color,'#070c17');
 assert.equal(manifest.display,'standalone');
 assert.deepEqual(manifest.icons.map(icon=>icon.src),['/icons/icon-192.png','/icons/icon-512.png']);
 for(const icon of manifest.icons){
  assert.equal(icon.type,'image/png');
  assert.equal(icon.purpose,'any');
 }
});

test('shared visual layer preserves responsive focus and reduced-motion contracts',()=>{
 const css=source('src/style.css');
 assert.match(css,/DS011 Experience Renewal/);
 assert.match(css,/--bg:#070c17/);
 assert.match(css,/--accent:#7ee9eb/);
 assert.match(css,/--violet:#b7a1f6/);
 assert.match(css,/button:focus-visible,a:focus-visible,input:focus-visible/);
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css, /body\[data-motion=reduced\]/);
 assert.match(css, /safe-area-inset-top/);
 assert.ok(contrast('#f2f8ff','#070c17')>=7);
 assert.ok(contrast('#a4b6c8','#070c17')>=7);
 assert.ok(contrast('#071924','#91f0f0')>=7);
});
