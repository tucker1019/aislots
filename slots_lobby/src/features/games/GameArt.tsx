import type { GameArt as ArtType } from './types';
import { MahjongArt } from './MahjongArt';
function Diamond({ x, y, scale = 1, color = '#6c62ce' }: { x: number; y: number; scale?: number; color?: string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M-60-20-32-52H32L60-20 0 57Z" fill={color} />
    <path d="m-60-20 60 77-22-77ZM60-20 0 57l22-77Z" fill="#fff" opacity=".25" />
    <path d="M-32-52-22-20H22L32-52Z" fill="#fff" opacity=".35" /><path d="M-60-20H60" stroke="#fff" strokeOpacity=".4" /></g>;
}
export function GameArt({ art }: { art: ArtType }) {
  if (art === 'mahjong') return <MahjongArt />;
  return <svg className={`game-illustration illustration-${art}`} viewBox="0 0 320 220" fill="none" aria-hidden="true">
    {art === 'candy' && <>
      <g transform="rotate(-23 165 115)"><path d="m96 93-42-24 8 46-8 43 42-24M222 93l42-24-8 46 8 43-42-24" fill="#cf98c6" />
        <rect x="90" y="65" width="138" height="100" rx="45" fill="#e5a4c1" /><path d="M118 72c0 35 63 22 63 82M154 68c0 33 61 25 61 66" stroke="#fff2e8" strokeWidth="19" />
        <path d="M113 92c9-13 22-15 32-13" stroke="#fff" strokeOpacity=".7" strokeWidth="7" strokeLinecap="round" /></g>
      <circle cx="252" cy="61" r="15" fill="#eecc86" /><circle cx="73" cy="176" r="9" fill="#b7b9de" />
    </>}
    {art === 'seven' && <>
      <text x="27" y="159" fontSize="100" fontFamily="Georgia,serif" fontWeight="700" fill="#b24845" opacity=".15" transform="rotate(-14 80 110)">7</text>
      <text x="225" y="154" fontSize="100" fontFamily="Georgia,serif" fontWeight="700" fill="#b24845" opacity=".15" transform="rotate(15 250 110)">7</text>
      <text x="105" y="176" fontSize="165" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fill="#a93b3e" stroke="#f0d2ad" strokeWidth="4" paintOrder="stroke">7</text>
      <path d="m220 44 3 11 11 3-11 3-3 11-3-11-11-3 11-3Z" fill="#c99547" />
    </>}
    {art === 'ocean' && <>
      <circle cx="160" cy="112" r="73" stroke="#a9c9cd" strokeWidth="1" /><circle cx="160" cy="112" r="89" stroke="#bad6d7" strokeWidth="1" />
      <path d="M86 124c-6-44 18-73 39-62 10-25 40-26 49-2 23-16 49 5 47 29 23 2 30 27 13 44l-66 45Z" fill="#7ba9b3" />
      <path d="m126 72 31 92M167 69l-4 95M208 91l-39 74M101 99l55 68" stroke="#c1d7d5" strokeWidth="5" strokeLinecap="round" />
      <path d="M80 131q80 58 161 0-11 61-80 59-66-1-81-59" fill="#61939f" />
      <circle cx="161" cy="141" r="32" fill="#f2f1e7" /><circle cx="151" cy="131" r="9" fill="#fff" opacity=".8" />
    </>}
    {art === 'gems' && <><Diamond x={83} y={137} scale={.65} color="#96b4b9" /><Diamond x={178} y={100} scale={1.05} /><Diamond x={251} y={151} scale={.52} color="#c291b7" /></>}
    {art === 'fruit' && <>
      <path d="M115 103q-5-51 60-60-28 22-20 67" stroke="#60866a" strokeWidth="7" strokeLinecap="round" />
      <path d="M165 53q37-28 65-3-36 29-65 3" fill="#6f9a72" />
      <circle cx="112" cy="141" r="47" fill="#cf694d" /><circle cx="181" cy="147" r="49" fill="#e19b55" />
      <path d="M82 127q7-14 20-16M149 130q8-15 21-16" stroke="#fff3df" strokeOpacity=".7" strokeWidth="6" strokeLinecap="round" />
    </>}
    {art === 'moon' && <>
      <path d="M101 200V103a59 59 0 0 1 118 0v97" fill="#343b56" stroke="#66708c" strokeWidth="2" />
      <path d="M117 200v-96a43 43 0 0 1 86 0v96" fill="#1f2942" />
      <path d="M179 76a34 34 0 1 0 17 57 29 29 0 0 1-17-57" fill="#ddc78d" />
      <path d="M86 200h148M92 188h136" stroke="#72758a" strokeWidth="5" />
      <path d="m76 68 2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM245 107l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#d7c693" />
    </>}
  </svg>;
}
