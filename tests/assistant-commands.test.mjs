import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSISTANT_COMMANDS,parseAssistantCommand,normalizeAssistantShortcut,validateAssistantCommands} from '../src/assistant-commands.mjs';
test('first commands are versioned read-only requests, not autonomous authority',()=>{
 assert.equal(validateAssistantCommands(ASSISTANT_COMMANDS),true);
 for(const input of ['/status','/continue']){
  const result=parseAssistantCommand('  '+input+'  ');
  assert.equal(result.executionClass,'A0');
  assert.equal(result.version,1);
  assert.equal(result.requiredWorkspace,'software');
  assert.equal(result.shortcut,null);
 }
});
test('parser rejects free text, parameters, commands with injected instructions and malformed input',()=>{
 for(const input of ['/status then deploy','/continue\n/execute','/execute','/status --project=other','status','/status\u0000',null,'/'.repeat(90)])
  assert.throws(()=>parseAssistantCommand(input));
});
test('shortcut normalization rejects unsupported or reserved bindings and collisions',()=>{
 assert.equal(normalizeAssistantShortcut('Shift+Alt+S'),'Alt+Shift+S');
 assert.equal(normalizeAssistantShortcut('Ctrl+S'),null);
 const def=(id,shortcut)=>({id,version:1,label:'/'+id,executionClass:'A0',requiredWorkspace:'software',shortcut});
 assert.throws(()=>validateAssistantCommands([def('status','Mod+K')]),/shortcut/);
 assert.throws(()=>validateAssistantCommands([def('status','Mod+Shift+I')]),/shortcut/);
 assert.throws(()=>validateAssistantCommands([def('status','Alt+Tab')]),/shortcut/);
 assert.throws(()=>validateAssistantCommands([def('status','Alt+S'),def('continue','Alt+S')]),/shortcut/);
 assert.throws(()=>validateAssistantCommands([def('status','Ctrl+S')]),/shortcut/);
 assert.equal(validateAssistantCommands([def('status','Alt+S'),def('continue','Mod+Shift+C')]),true);
});
