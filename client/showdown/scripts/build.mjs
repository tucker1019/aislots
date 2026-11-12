import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const creator=process.env.COCOS_CREATOR || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
const root=new URL('../',import.meta.url).pathname;
const result=spawnSync(creator,['--project',root,'--build',`configPath=${root}buildConfig_web-mobile.json;platform=web-mobile;debug=true;md5Cache=true`],{encoding:'utf8',maxBuffer:32*1024*1024});
const output=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(new URL('../.build.log',import.meta.url),output);
const completed=/build Task \(web-mobile\) Finished/.test(output)&&fs.existsSync(new URL('../build/web-mobile/index.html',import.meta.url));
console.log(output.split('\n').slice(-12).join('\n'));if(!completed||![0,36].includes(result.status))process.exit(result.status||1);
