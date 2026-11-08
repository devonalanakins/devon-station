// Generation 2 read-only commands. Commands request information; none grant action authority.
export const ASSISTANT_COMMANDS=Object.freeze([
 Object.freeze({id:'status',version:1,label:'/status',executionClass:'A0',requiredWorkspace:'software',shortcut:null}),
 Object.freeze({id:'continue',version:1,label:'/continue',executionClass:'A0',requiredWorkspace:'software',shortcut:null}),
]);
const RESERVED=new Set(['Mod+K','Mod+L','Mod+R','Mod+T','Mod+W','Mod+Q','Mod+Shift+I','Mod+Shift+J','Alt+Tab']);
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,31}$/.test(id);
export function normalizeAssistantShortcut(value){
 if(typeof value!=='string'||value.length>32)return null;
 const parts=value.split('+'),key=parts.pop(),mods=new Set(parts);
 if(mods.size!==parts.length||parts.some(x=>!['Mod','Alt','Shift'].includes(x)))return null;
 if(!mods.has('Mod')&&!mods.has('Alt'))return null;
 if(!/^[A-Z0-9]$/.test(key||''))return null;
 return ['Mod','Alt','Shift'].filter(x=>mods.has(x)).concat(key).join('+');
}
export function validateAssistantCommands(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>32)throw Error('invalid_command_registry');
 const ids=new Set(),shortcuts=new Set();
 for(const entry of entries){
  if(!entry||!validId(entry.id)||ids.has(entry.id)||!Number.isSafeInteger(entry.version)||entry.version<1||
     entry.label!=='/'+entry.id||entry.executionClass!=='A0'||entry.requiredWorkspace!=='software')throw Error('invalid_command_definition');
  ids.add(entry.id);
  if(entry.shortcut!=null){
   const shortcut=normalizeAssistantShortcut(entry.shortcut);
   if(!shortcut||RESERVED.has(shortcut)||shortcuts.has(shortcut))throw Error('shortcut_denied_or_conflicting');
   shortcuts.add(shortcut);
  }
 }
 return true;
}
export function parseAssistantCommand(input){
 if(typeof input!=='string'||input.length>64)throw Error('invalid_assistant_command');
 const text=input.trim();
 const command=ASSISTANT_COMMANDS.find(c=>c.label===text);
 if(!command)throw Error('unsupported_assistant_command');
 return command;
}
validateAssistantCommands(ASSISTANT_COMMANDS);
