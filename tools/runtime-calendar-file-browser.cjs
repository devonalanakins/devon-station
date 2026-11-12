/* Read-only local .ics acceptance: synthetic personal events, never external providers. */
const {chromium}=require('playwright');
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
(async()=>{
 const {start,token}=await import('./runtime-harness.mjs');
 const dir=mkdtempSync(join(tmpdir(),'ds-calendar-local-'));
 let server,browser;const results=[];
 try{
  server=await start(join(dir,'synthetic.sqlite'));
  browser=await chromium.launch({executablePath:process.env.DS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,
    extraHTTPHeaders:{'Cf-Access-Jwt-Assertion':token()},serviceWorkers:'block',reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',err=>errors.push(err.message));
   page.on('request',req=>{if(!req.url().startsWith(server.url))external.push(req.url());});
   await page.goto(server.url+'/#today');
   const panel=page.locator('#station-calendar-import');
   await panel.waitFor();
   const civil=await page.evaluate(()=>{const d=new Date();return String(d.getFullYear()).padStart(4,'0')+
    String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');});
   const day=civil.replaceAll('-','');
   const nextDate=new Date(civil.slice(0,4)+'-'+civil.slice(4,6)+'-'+civil.slice(6,8)+'T12:00:00Z');nextDate.setUTCDate(nextDate.getUTCDate()+1);
   const next=nextDate.toISOString().slice(0,10).replaceAll('-','');
   const privateMarker='SYNTHETIC_LOCAL_CALENDAR_ONLY_'+width;
   const file='BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+
    'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:'+day+'\r\nDTEND;VALUE=DATE:'+next+
    '\r\nSUMMARY:'+privateMarker+'\r\nEND:VEVENT\r\n'+
    'BEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:'+day+'T090000\r\nSUMMARY:<img src=x onerror=alert(1)>\r\nEND:VEVENT\r\n'+
    'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:'+day+'\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Skipped recurring synthetic item\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
   await panel.locator('#calendar-import-file').setInputFiles({name:'owner-personal.ics',mimeType:'text/calendar',buffer:Buffer.from(file)});
   await panel.getByText(privateMarker).waitFor();
   await panel.getByText('<img src=x onerror=alert(1)>').waitFor();
   if(await panel.locator('img').count())throw Error('untrusted file content parsed as HTML');
   if(await panel.locator('.calendar-import-event').count()!==2)throw Error('unsupported recurrence appeared as complete');
   const status=await panel.locator('#calendar-import-status').textContent();
   if(!status.includes('1 omitted (recurring 1')||!status.includes('not live calendar availability'))throw Error('unsupported recurrence not disclosed');
   const stored=await page.evaluate(()=>[localStorage.getItem('devon-station:local:v1')||'',sessionStorage.getItem('devon-station:tab-recovery:v1')||'']);
   if(stored.some(x=>x.includes(privateMarker)))throw Error('calendar leaked to storage');
   await page.addScriptTag({content:require('axe-core').source});
   const a11y=await page.evaluate(async()=>(
    await axe.run(document.querySelector('#station-calendar-import'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})
   ).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   if(a11y.length)throw Error('calendar accessibility '+width+': '+JSON.stringify(a11y));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   if(overflow>1)throw Error('calendar overflow '+width+': '+overflow);
   await panel.scrollIntoViewIfNeeded();
   await page.screenshot({path:join(__dirname,'calendar-import-'+width+'.png'),fullPage:false});
   await page.locator('#nav [data-go=home]').click();
   await page.locator('#nav [data-go=today]').click();
   await panel.getByText(privateMarker).waitFor(); // memory-only until reload
   await panel.getByRole('button',{name:'Clear calendar preview'}).click();
   await panel.getByText('No personal calendar file selected.',{exact:false}).waitFor();
   if(await panel.getByText(privateMarker).count())throw Error('clear retained event');
   await panel.locator('#calendar-import-file').setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from(file)});
   await panel.getByText('Choose a nonempty personal .ics file smaller than 256 KB.',{exact:false}).waitFor();
   await panel.locator('#calendar-import-file').setInputFiles({name:'owner-personal.ics',mimeType:'text/calendar',buffer:Buffer.from(file)});
   await panel.getByText(privateMarker).waitFor();
   await page.reload();
   await panel.getByText('No personal calendar file selected.',{exact:false}).waitFor();
   if(await page.content().then(s=>s.includes(privateMarker)))throw Error('file content persisted after reload');
   if(errors.length||external.length||server.externalCalls())throw Error('script or external call '+JSON.stringify({errors,external,count:server.externalCalls()}));
   results.push({width,localPreview:true,recurrenceOmitted:true,htmlSafe:true,clearAndReload:true,overflow,axe:0,externalCalls:0});
   await context.close();
  }
  writeFileSync(join(__dirname,'calendar-import-browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 }finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
