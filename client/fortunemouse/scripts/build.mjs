import {spawnSync} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const creator = process.env.COCOS_CREATOR ||
    '/Applications/Cocos/Creator/3.8.5/CocosCreator.app/Contents/MacOS/CocosCreator';
const result = spawnSync(creator, ['--project', root, '--build',
    `configPath=${root}buildConfig_web-mobile.json;platform=web-mobile;debug=true;md5Cache=true`],
    {encoding:'utf8', maxBuffer:32 * 1024 * 1024});
const output = (result.stdout || '') + (result.stderr || '');
writeFileSync(new URL('../.build.log', import.meta.url), output);
const completed = /build Task \(web-mobile\) Finished/.test(output) &&
    existsSync(new URL('../build/web-mobile/index.html', import.meta.url));
if (result.error) console.error(result.error);
console.log(output.split('\n').slice(-12).join('\n'));
if (!completed || ![0, 36].includes(result.status)) process.exit(result.status || 1);
