import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
export function loadTypeScript(url){
 if(cache.has(url.href))return cache.get(url.href);
 const module={exports:{}};
 cache.set(url.href,module.exports);
 const compiled=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module',compiled)(name=>loadTypeScript(new URL(name+'.ts',url)),module.exports,module);
 return module.exports;
}
