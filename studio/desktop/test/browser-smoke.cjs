const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const net = require('node:net');
const { chromium } = require('playwright');

function freePort() {
  return new Promise((res,rej) => {
    const server = net.createServer();
    server.once('error',rej);
    server.listen(0,'127.0.0.1',() => {
      const port = server.address().port;
      server.close(() => res(port));
    });
  });
}
async function waitForServer(url, child) {
  const deadline=Date.now()+120000;
  while (Date.now()<deadline) {
    if (child.exitCode !== null) throw new Error('Theia backend terminated unexpectedly: ' + child.exitCode);
    try { const r=await fetch(url); if (r.status===200) return; } catch {}
    await new Promise(r=>setTimeout(r,800));
  }
  throw new Error('Theia did not start');
}
async function main() {
  const checkout=resolve(__dirname,'../../..');
  const root=mkdtempSync(join(tmpdir(),'ds-studio-browser-'));
  const src=join(root,'src');
  mkdirSync(src);
  const file=join(src,'sample.ts');
  writeFileSync(file,'export const answer = 41;\n');
  execFileSync('git',['init','-q',root]);
  execFileSync('git',['-C',root,'remote','add','origin','https://github.com/devonalanakins/devon-station.git']);
  const port=await freePort();
  const url='http://127.0.0.1:'+port;
  const logs=[];
  const child=spawn(process.execPath,[join(checkout,'studio/desktop/src/launch.mjs'),
    '--workspace='+root,'--project=devon-station','--port='+port,'--ci-smoke'],
    {cwd:checkout,env:{...process.env,GITHUB_ACTIONS:'true'},stdio:['ignore','pipe','pipe']});
  for (const stream of [child.stdout,child.stderr]) stream.on('data',v => {
    const chunk=v.toString();
    logs.push(chunk);
    if (logs.join('').length>40000) logs.shift();
  });
  let browser;
  try {
    await waitForServer(url,child);
    browser=await chromium.launch({headless:true,executablePath:process.env.DS_CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--disable-dev-shm-usage']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200);
    await page.locator('.theia-ApplicationShell').waitFor({timeout:90000});
    // Theia can delay plugin/workspace restoration beyond shell readiness.
    // Exercise the real Explorer user journey; never write the file through a test-only API.
    await page.keyboard.press('Control+Shift+e');
    let src=page.getByText('src',{exact:true}).first();
    try {
      await src.waitFor({timeout:10000});
    } catch (firstError) {
      console.log('STUDIO_UI_DIAGNOSTICS',JSON.stringify(await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        text: document.body.innerText.slice(0,3500),
        inputs:[...document.querySelectorAll('input')].map(e=>({type:e.type,placeholder:e.placeholder,role:e.getAttribute('role'),classes:e.className})).slice(0,12),
        nav: [...document.querySelectorAll('[class*="navigator"],[class*="Navigator"],[class*="explorer"],[class*="Explorer"]')].slice(0,10).map(e=>({cls:typeof e.className==='string'?e.className:'',text:e.textContent?.slice(0,200)}))
      }))));
      await page.getByText('View',{exact:true}).first().click();
      console.log('STUDIO_VIEW_MENU',JSON.stringify((await page.locator('body').innerText()).slice(0,2500)));
      const explorer=page.getByRole('menuitem',{name:/Explorer/i}).first();
      if(await explorer.count()) await explorer.click();
      else await page.keyboard.press('Escape');
      src=page.getByText('src',{exact:true}).first();
      await src.waitFor({timeout:10000});
    }
    await src.dblclick();
    await page.getByText('sample.ts',{exact:true}).first().dblclick();
    const editor=page.locator('.monaco-editor').first();
    await editor.waitFor({timeout:30000});
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('export const answer = 42;');
    await page.keyboard.press('Control+s');
    const deadline=Date.now()+15000;
    while(Date.now()<deadline && readFileSync(file,'utf8')!=='export const answer = 42;')
      await new Promise(r=>setTimeout(r,300));
    assert.equal(readFileSync(file,'utf8'),'export const answer = 42;',
      'actual Theia edit must persist to authorized Git working tree');
    await page.reload();
    await page.locator('.theia-ApplicationShell').waitFor({timeout:45000});
    assert.equal(readFileSync(file,'utf8'),'export const answer = 42;');
    assert.deepEqual(errors,[]);
    process.stdout.write(JSON.stringify({theiaLoaded:true,realFileEdited:true,persistedAfterReload:true,
      project:'devon-station',publicPublishing:false,providerCalls:0})+'\n');
  } catch(error) {
    process.stderr.write('Theia smoke failed: '+error.stack+'\n'+logs.join('').slice(-7000)+'\n');
    try {
      process.stderr.write('Workbench visible content: '+(await browser?.contexts()?.[0]?.pages()?.[0]?.locator('body').innerText()).slice(0,3000)+'\n');
    } catch {}

    process.exitCode=1;
  } finally {
    await browser?.close();
    child.kill('SIGTERM');
    await new Promise(r=>{if(child.exitCode!==null||child.signalCode!==null)r();else {child.once('exit',r);setTimeout(r,5000);}});
    rmSync(root,{recursive:true,force:true});
  }
}
main().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1});
