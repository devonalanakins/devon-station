/* Synthetic personal-calendar owner flow: browser-local mock, no provider credentials. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
(async()=>{
 const {start,token}=await import('./runtime-harness.mjs');
 const dir=mkdtempSync(join(tmpdir(),'ds-calendar-provider-'));
 let server,browser;const results=[];
 try{
  server=await start(join(dir,'synthetic.sqlite'));
  browser=await chromium.launch({executablePath:process.env.DS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,
     reducedMotion:'reduce',serviceWorkers:'block',extraHTTPHeaders:{'Cf-Access-Jwt-Assertion':token()}});
   const page=await context.newPage(),errors=[],external=[];let apiCalls=0;
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',req=>{if(!req.url().startsWith(server.url))external.push(req.url());});
   await page.goto(server.url+'/#today');
   const panel=page.locator('#station-personal-calendar');
   await panel.waitFor();
   assert.equal(await panel.getByRole('button',{name:'Check personal calendar'}).count(),1);
   assert.match(await panel.locator('#personal-calendar-status').textContent(),/No live personal calendar data/);
   // A real request is disabled on the unconfigured synthetic server.
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText('No approved personal calendar connection is available',{exact:false}).waitFor();
   const day=await page.evaluate(()=>{
    const d=new Date();return String(d.getFullYear()).padStart(4,'0')+'-'+
     String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   });
   const next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
   const marker='SYNTHETIC_PRIVATE_CALENDAR_'+width+'_XSS_<img src=x onerror=alert(1)>';
   const followup='SYNTHETIC_PERSONAL_FOLLOWUP_'+width;
   const source={source:'google_calendar_personal',scope:'personal',mode:'read_only',
     observedAt:new Date().toISOString(),requestedDay:day,partial:false,excluded:0,
     events:[{title:marker,start:{date:day},end:{date:next.toISOString().slice(0,10)},confirmation:'confirmed'},
      {title:followup,start:{date:day},end:{date:next.toISOString().slice(0,10)},confirmation:'confirmed'}]};
   await page.route('**/api/calendar/personal?*',route=>{
    apiCalls++;
    assert.equal(route.request().method(),'GET');
    assert.equal(new URL(route.request().url()).searchParams.get('day'),day);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source)});
   });
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText(marker,{exact:true}).waitFor();
   assert.equal(await panel.locator('img,script').count(),0,'untrusted calendar content as markup');
   assert.match(await panel.locator('#personal-calendar-status').textContent(),/not proof of complete availability/);
   const stored=await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)]);
   assert(!stored.some(v=>v.includes(marker)),'private source copied to storage');
   await page.addScriptTag({content:require('axe-core').source});
   const violations=await page.evaluate(async()=>(
    await axe.run(document.getElementById('station-personal-calendar'),
     {runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})
   ).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],'calendar accessibility '+width);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=1,'calendar overflow '+width+': '+overflow);
   await panel.scrollIntoViewIfNeeded();
   await page.screenshot({path:join(__dirname,'personal-calendar-'+width+'.png'),fullPage:false});
   // Calendar previews are untrusted source records, never autonomous owner tasks.
   const selected=panel.locator('.calendar-live-event').filter({hasText:followup});
   const beforeReview=await page.evaluate(()=>localStorage.getItem('devon-station:local:v1')||'');
   await selected.getByRole('button',{name:'Plan follow-up for '+followup}).click();
   await page.locator('#capture[open]').waitFor();
   assert.equal(await page.locator('#capture-text').inputValue(),'Follow up: '+followup);
   assert.equal(await page.locator('#capture-date').inputValue(),day);
   assert.match(await page.locator('#capture-source-note').textContent(),/read-only personal calendar provider snapshot/);
   assert(await page.locator('#capture-source-note').isVisible(),'source review warning must be shown');
   assert.equal(await page.evaluate(()=>localStorage.getItem('devon-station:local:v1')||''),beforeReview,
    'opening a provider-derived capture must not persist');
   await page.locator('#capture').getByRole('button',{name:'Cancel'}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('devon-station:local:v1')||''),beforeReview,
    'cancel must not persist');
   await selected.getByRole('button',{name:'Plan follow-up for '+followup}).click();
   await page.locator('#capture[open]').waitFor();
   await page.locator('#capture').getByRole('button',{name:'Save local draft'}).click();
   await page.getByText('Follow up: '+followup,{exact:true}).waitFor();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('devon-station:local:v1')||'{}').drafts??[]);
   assert(saved.some(d=>d.title==='Follow up: '+followup&&d.planDate===day&&d.area==='Family & Home'),
    'explicit owner submit must create the planned follow-up through the existing draft system');
   assert(!saved.some(d=>d.title.includes(marker)),'source event must not be persisted wholesale');
   await page.locator('#nav [data-go=today]').click();
   await panel.getByText('No live personal calendar data loaded',{exact:false}).waitFor();
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText(marker,{exact:true}).waitFor();
   await panel.getByRole('button',{name:'Clear preview'}).click();
   await panel.getByText('No live personal calendar data loaded',{exact:false}).waitFor();
   assert.equal(await panel.getByText(marker,{exact:true}).count(),0,'clear retained event');
   await page.unroute('**/api/calendar/personal?*');
   await page.route('**/api/calendar/personal?*',route=>route.fulfill({status:403,contentType:'application/json',body:'{"error":"denied"}'}));
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText('This owner or personal calendar is not authorized',{exact:false}).waitFor();
   await page.unroute('**/api/calendar/personal?*');
   await page.route('**/api/calendar/personal?*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"fake":"live"}'}));
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText('calendar response was invalid',{exact:false}).waitFor();
   await page.unroute('**/api/calendar/personal?*');
   await page.route('**/api/calendar/personal?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source)}));
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText(marker,{exact:true}).waitFor();
   await page.locator('#nav [data-go=home]').click();
   await page.locator('#nav [data-go=today]').click();
   await panel.getByText('No live personal calendar data loaded',{exact:false}).waitFor();
   assert.equal(await panel.getByText(marker,{exact:true}).count(),0,'route departure retained event');
   await panel.getByRole('button',{name:'Check personal calendar'}).click();
   await panel.getByText(marker,{exact:true}).waitFor();
   await page.reload();
   await panel.getByText('No live personal calendar data loaded',{exact:false}).waitFor();
   assert.equal(await panel.getByText(marker,{exact:true}).count(),0,'reload retained event');
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(server.externalCalls(),0);
   results.push({width,optIn:true,disabledDefault:true,textSafe:true,reviewedFollowup:true,cancelWithoutWrite:true,explicitSave:true,clear:true,denyVisible:true,
     invalidRejected:true,routeAndReloadDiscard:true,axeViolations:0,overflow,apiCalls});
   await context.close();
  }
  writeFileSync(join(__dirname,'personal-calendar-browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 }finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
