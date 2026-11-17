// Rebuild with Node and sharp: node build.mjs /absolute/path/to/sharp
import {URL} from 'node:url';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const source = new URL('./', import.meta.url);
const target = new URL('../../public/assets/lobby/chests/', import.meta.url);
function chest(state) {
  const locked = state === 'locked';
  const active = state === 'claimable';
  const gold = locked ? '#DDBB79' : active ? '#FFD15C' : '#D2B8EB';
  const goldShade = locked ? '#987345' : active ? '#CF8C36' : '#8665AD';
  const purple = locked ? '#7955A3' : active ? '#9655FF' : '#684493';
  const light = locked ? '#A887C5' : active ? '#CA9BFF' : '#A17DC3';
  const outline = '#21103D';
  const coin = (x,y,r) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#FFD15C" stroke="#A96C2A" stroke-width="4"/><circle r="${r-5}" fill="none" stroke="#FFF0AC" stroke-width="2.5"/><path d="M-3 -6h6v12h-6z" fill="#B57529"/></g>`;
  const star = (x,y,s) => `<path d="M${x} ${y-s}Q${x+2} ${y-2} ${x+s} ${y}Q${x+2} ${y+2} ${x} ${y+s}Q${x-2} ${y+2} ${x-s} ${y}Q${x-2} ${y-2} ${x} ${y-s}Z" fill="#FFE594" stroke="${outline}" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
<defs><linearGradient id="body" x2="0" y2="1"><stop stop-color="${purple}"/><stop offset="1" stop-color="#4D2875"/></linearGradient><linearGradient id="lid" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${purple}"/></linearGradient><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#FFF0AF"/><stop offset=".38" stop-color="${gold}"/><stop offset="1" stop-color="${goldShade}"/></linearGradient></defs>
${!locked ? `<path d="M32 89L37 53Q39 38 55 33L141 24Q154 23 158 40L165 80Z" fill="url(#lid)" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/><path d="M47 74L51 51Q52 48 60 46L139 38L145 70Z" fill="#21103D" stroke="${goldShade}" stroke-width="5" stroke-linejoin="round"/><path d="M32 89L165 80L152 111L30 114Z" fill="#21103D" stroke="${outline}" stroke-width="5"/>` : ''}
${active ? `${coin(63,85,18)}${coin(114,78,19)}${coin(90,94,19)}${coin(140,95,14)}` : ''}
<path d="M145 101L170 87V143Q170 155 156 162L145 164Z" fill="#4D2875" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
<path d="M23 96L146 96L146 164H39Q23 164 23 148Z" fill="url(#body)" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
<path d="M25 145Q25 159 41 159H145" fill="none" stroke="#B18ADD" stroke-width="3" opacity=".5"/>
<path d="M45 98H61V163H45ZM116 98H132V163H116Z" fill="url(#gold)" stroke="${outline}" stroke-width="3"/>
<path d="M24 95L146 95L169 84L169 101L146 113H24Z" fill="url(#gold)" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>
${locked ? `<path d="M24 95V82Q24 49 59 49H118Q143 49 147 77L148 96Z" fill="url(#lid)" stroke="${outline}" stroke-width="6"/><path d="M46 94V80Q46 57 61 53H70Q60 63 60 81V94ZM116 51Q131 60 132 83V94H116V79Q116 62 107 51Z" fill="url(#gold)" stroke="${outline}" stroke-width="3"/><path d="M31 88H141" stroke="#DDBB79" stroke-width="7"/><path d="M76 114V104Q76 91 87 91Q99 91 99 104V114" fill="none" stroke="${outline}" stroke-width="13"/><path d="M76 114V104Q76 91 87 91Q99 91 99 104V114" fill="none" stroke="#E5D6FA" stroke-width="7"/><rect x="69" y="108" width="37" height="34" rx="10" fill="url(#gold)" stroke="${outline}" stroke-width="4"/><circle cx="87" cy="121" r="4" fill="${outline}"/><path d="M85 123H89L91 132H83Z" fill="${outline}"/>` : `<path d="M75 110H100V134Q87 145 75 134Z" fill="url(#gold)" stroke="${outline}" stroke-width="4"/><path d="M87 116L90 122L97 123L92 128L93 135L87 131L81 135L82 128L77 123L84 122Z" fill="${active ? '#9655FF' : '#684493'}"/>`}
${active ? `${star(27,44,10)}${star(171,55,12)}${star(157,20,7)}` : ''}
</svg>`;
}
for(const state of ['locked','claimable','claimed']) {
  const svg = chest(state);
  await writeFile(new URL(`${state}.svg`,source),svg);
  await sharp(Buffer.from(svg)).resize(192,192).webp({lossless:true}).toFile(new URL(`${state}.webp`,target).pathname);
}
