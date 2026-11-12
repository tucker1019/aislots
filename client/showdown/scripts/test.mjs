import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);const out=new URL('.test-build/',root);
for(const relative of ['network/game_types','network/launch_session','network/game_api','network/frame_adapter','network/round_controller','network/display','history/history_types','history/history_response']){
 const input=new URL('assets/wildbountyshowdown/src/'+relative+'.ts',root);const dest=new URL(relative+'.mjs',out);fs.mkdirSync(new URL('./',dest),{recursive:true});
 const code=ts.transpile(fs.readFileSync(input,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}).replace(/from ['"](\.{1,2}\/[^'"]+)['"]/g,`from '$1.mjs'`);fs.writeFileSync(dest,code);
}
const result=spawnSync(process.execPath,['--test',...fs.readdirSync(new URL('tests/',root)).filter(name=>name.endsWith('.test.mjs')).map(name=>new URL('tests/'+name,root).pathname)],{stdio:'inherit'});process.exit(result.status??1);
