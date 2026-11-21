import test from 'node:test';
import assert from 'node:assert/strict';
import {createStation,resolveOwnerIdentity} from '../worker/index.mjs';

const oldUser={subject:'old-signed-owner-uuid',email:'owner@legacy.example.test'};
const newUser={subject:'new-signed-owner-uuid',email:'owner@current.example.test'};
const cfg={
 OWNER_EMAIL:'owner@legacy.example.test',
 OWNER_LEGACY_SUB:'old-signed-owner-uuid',
 OWNER_CURRENT_EMAIL:'owner@current.example.test',
 OWNER_CURRENT_SUB:'new-signed-owner-uuid',
 OWNER_ALIAS_ENABLED:'true'
};

test('default identity remains the existing owner with no alias configured',()=>{
 assert.deepEqual(resolveOwnerIdentity(oldUser,{OWNER_EMAIL:cfg.OWNER_EMAIL}),oldUser);
 assert.equal(resolveOwnerIdentity(newUser,{OWNER_EMAIL:cfg.OWNER_EMAIL}),null);
});

test('a production owner email already updated to current can still preserve historical storage subject',()=>{
 const updated={...cfg,OWNER_EMAIL:newUser.email};
 assert.deepEqual(resolveOwnerIdentity(newUser,updated),{subject:oldUser.subject,email:newUser.email});
 assert.equal(resolveOwnerIdentity(oldUser,updated),null,'retired login must not be reopened by alias');
 assert.deepEqual(resolveOwnerIdentity(newUser,{...updated,OWNER_ALIAS_ENABLED:'false'}),newUser,
   'with alias disabled existing production sign-in retains current subject');
 assert.equal(resolveOwnerIdentity({...newUser,subject:oldUser.subject},updated),null);
});

test('transition maps only a verified exact new Access identity back to existing storage subject',()=>{
 assert.deepEqual(resolveOwnerIdentity(newUser,cfg),{subject:oldUser.subject,email:newUser.email});
 assert.deepEqual(resolveOwnerIdentity(oldUser,cfg),oldUser);
 assert.equal(resolveOwnerIdentity({...newUser,subject:'not-current-subject'},cfg),null);
 assert.equal(resolveOwnerIdentity({...newUser,email:'attacker@example.test'},cfg),null);
 assert.equal(resolveOwnerIdentity({...oldUser,subject:'not-legacy-subject'},cfg),null);
});

test('feature stays closed on missing or unsafe transition configuration',()=>{
 for(const key of ['OWNER_LEGACY_SUB','OWNER_CURRENT_EMAIL','OWNER_CURRENT_SUB']){
  assert.equal(resolveOwnerIdentity(newUser,{...cfg,[key]:''}),null,key);
 }
 assert.equal(resolveOwnerIdentity(newUser,{...cfg,OWNER_ALIAS_ENABLED:'false'}),null);
 assert.equal(resolveOwnerIdentity(newUser,{...cfg,OWNER_ALIAS_ENABLED:undefined}),null);
 assert.equal(resolveOwnerIdentity(newUser,{...cfg,OWNER_CURRENT_SUB:cfg.OWNER_LEGACY_SUB}),null);
 assert.equal(resolveOwnerIdentity(newUser,{...cfg,OWNER_CURRENT_EMAIL:cfg.OWNER_EMAIL}),null);
 assert.equal(resolveOwnerIdentity(newUser,{...cfg,OWNER_EMAIL:''}),null);
});

test('no unsigned, anonymous, header-derived or malformed identity can enter',()=>{
 for(const bad of [null,{}, {email:newUser.email},{subject:newUser.subject},
 {subject:5,email:newUser.email},{subject:newUser.subject,email:null},
 {subject:'',email:newUser.email}])assert.equal(resolveOwnerIdentity(bad,cfg),null);
 const suppliedHeaders = {headers:{'X-Owner-Email':newUser.email}};
 assert.equal(resolveOwnerIdentity(suppliedHeaders,cfg),null);
});

test('email formatting is normalized without altering the signed identity subject',()=>{
 assert.deepEqual(resolveOwnerIdentity({subject:newUser.subject,email:'OWNER@CURRENT.EXAMPLE.TEST'},cfg),
   {subject:oldUser.subject,email:newUser.email});
});

const stationOrigin='https://station.example.test';
const station=createStation({},async()=>newUser);
test('authenticated new owner gets existing owner API session without changing storage subject',async()=>{
 const response=await station.fetch(new Request(stationOrigin+'/api/session'),{APP_ORIGIN:stationOrigin,...cfg},{});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.authenticated,true);
 assert.equal(result.mode,'owner');
 const disabled=await station.fetch(new Request(stationOrigin+'/api/session'),{APP_ORIGIN:stationOrigin,...cfg,OWNER_ALIAS_ENABLED:'false'},{});
 assert.equal(disabled.status,403);
 const wrongSubjectStation=createStation({},async()=>({...newUser,subject:'impostor'}));
 assert.equal((await wrongSubjectStation.fetch(new Request(stationOrigin+'/api/session'),{APP_ORIGIN:stationOrigin,...cfg},{})).status,403);
});
