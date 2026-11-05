import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {fileURLToPath,URL} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../src',import.meta.url));
const issues=[];
const catalogs=['zh-TW','en-US'].map(locale=>({locale,messages:JSON.parse(fs.readFileSync(path.join(root,'i18n/locales',`${locale}.json`),'utf8'))}));
for(const {locale,messages} of catalogs){
 for(const key of Object.keys(messages))if(!/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/.test(key))issues.push(`${locale}: use an English semantic message key: ${key}`);
}
if(JSON.stringify(Object.keys(catalogs[0].messages).sort())!==JSON.stringify(Object.keys(catalogs[1].messages).sort()))issues.push('locale message keys must match');

function scan(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()){if(entry.name!=='i18n')scan(file);continue;}
  if(!/\.tsx?$/.test(file)||file.includes('.test.'))continue;
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){
   if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isJsxText(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))&&/\p{Script=Han}/u.test(node.text)){
    const position=source.getLineAndCharacterOfPosition(node.getStart(source));issues.push(`${path.relative(root,file)}:${position.line+1} - move UI copy to i18n/locales`);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
}
scan(root);
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log('i18n: no inline Chinese UI copy.');
