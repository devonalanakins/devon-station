/* Synthetic owner-bound Home evidence: no real provider, paid inference or production action. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

(async()=>{
 const {start,token}=await import('./runtime-harness.mjs');
 const directory=mkdtempSync(join(tmpdir(),'ds-home-evidence-'));
 let server,browser;const results=[];
 try{
  browser=await chromium.launch({executablePath:process.env.DS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  for(const width of [1440,390,320]){
   server=await start(join(directory,width+'.sqlite'),{assistantFixture:true,aiFixture:true});
   const context=await browser.newContext({
    viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,
    extraHTTPHeaders:{'Cf-Access-Jwt-Assertion':token()},reducedMotion:'reduce',serviceWorkers:'block'});
   for(const slug of ['devon-station','rhen']){
    const posted=await context.request.post(server.url+'/api/ai-work/jobs',{
     headers:{Origin:server.url,'Content-Type':'application/json'},
     data:{jobId:crypto.randomUUID(),projectSlug:slug,profile:'sandbox-review',
      task:'SYNTHETIC_PRIVATE_TASK_MUST_NOT_LEAK_'+slug,spendLimitCents:50}});
    assert.equal(posted.status(),200,slug);
   }
   const page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',err=>errors.push(err.message));
   page.on('request',req=>{if(!req.url().startsWith(server.url))external.push(req.url());});
   await page.goto(server.url+'/');
   await page.locator('#he-project[data-state=observed]').waitFor();
   await page.locator('#he-work[data-state=observed]').waitFor();
   assert.match(await page.locator('#he-project').textContent(),/PR #52/);
   assert.match(await page.locator('#he-project').textContent(),/Observed passing \(not merge or release approval\)/);
   assert.match(await page.locator('#he-work').textContent(),/2 saved job plans shown/);
   assert.doesNotMatch(await page.content(),/SYNTHETIC_PRIVATE_TASK_MUST_NOT_LEAK/);
   assert.equal(await page.locator('#he-project a[href="https://github.com/devonalanakins/devon-station/pull/52"]').count(),1);
   await page.addScriptTag({content:require('axe-core').source});
   const accessibility=await page.evaluate(async()=>(
    await axe.run(document.querySelector('.home-sources'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})
   ).violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})));
   assert.deepEqual(accessibility,[],'Home source accessibility '+width);
   assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=1,'Home overflow '+width);
   await page.screenshot({path:join(__dirname,'home-evidence-'+width+'.png'),fullPage:true});
   server.env.ASSISTANT_PROJECT_GRANTS_JSON='[]';
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-project[data-state=no-grant]').waitFor();
   assert.match(await page.locator('#he-project').textContent(),/No project-evidence grant/);
   await page.locator('#he-work[data-state=observed]').waitFor();
   server.env.ASSISTANT_PROJECT_GRANTS_JSON=JSON.stringify([{subject:'test-owner',workspaceId:'software',projectId:'devon-station',capability:'read-evidence'}]);
   server.env.AI_WORK_PROJECTS_JSON='["rhen"]';
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-work[data-state=observed]').getByText('1 saved job plans shown',{exact:false}).waitFor();
   server.env.AI_WORK_ENABLED='false';server.env.ASSISTANT_OWNER_SUB='different-owner';
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-project[data-state=denied]').waitFor();
   await page.locator('#he-work[data-state=unavailable]').waitFor();
   assert.doesNotMatch(await page.content(),/SYNTHETIC_PRIVATE_TASK_MUST_NOT_LEAK/);
   server.env.AI_WORK_ENABLED='true';server.env.ASSISTANT_OWNER_SUB='test-owner';
   server.env.AI_WORK_PROJECTS_JSON='["devon-station","rhen"]';
   await page.route('**/api/assistant/evidence?*',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({readOnly:true,projectId:'devon-station',command:'/status',
     workspaceId:'software',source:'github_public_repository_api',observedAt:'2026-11-12T13:00:00.000Z',nextAction:'INJECTED_FAKE_NEXT'})
   }));
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-project[data-state=invalid]').waitFor();
   assert.doesNotMatch(await page.content(),/INJECTED_FAKE_NEXT/);
   await page.unroute('**/api/assistant/evidence?*');
   await page.route('**/api/assistant/projects',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"unauthorized"}'}));
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-project[data-state=sign-in]').waitFor();
   await page.unroute('**/api/assistant/projects');
   await page.getByRole('button',{name:'Refresh sources'}).click();
   await page.locator('#he-project[data-state=observed]').waitFor();
   await page.locator('#he-work[data-state=observed]').waitFor();
   await page.locator('#nav [data-go=today]').click();
   assert.equal(await page.locator('#station-home-evidence').count(),0);
   await page.locator('#nav [data-go=home]').click();
   await page.locator('#he-project[data-state=observed]').waitFor();
   await page.locator('#he-work[data-state=observed]').waitFor();
   assert.deepEqual(errors,[],'browser JS errors');
   assert.deepEqual(external,[],'unexpected browser egress');
   assert.equal(server.externalCalls(),0,'unapproved GitHub egress');
   results.push({width,grantsVerified:true,workMetadataOnly:true,
    scopeDenied:true,unavailableVisible:true,invalidSourceRejected:true,
    signInVisible:true,navigationRecovery:true,axeViolations:0,
    overflow:0,externalCalls:0});
   await context.close();await server.close();server=null;
  }
  writeFileSync(join(__dirname,'home-evidence-browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 }finally{await browser?.close();await server?.close();rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
