import {create} from 'zustand';
export type ThemeMode='light'|'dark';
const storageKey='aislots-theme';
function initialTheme():ThemeMode{try{return localStorage.getItem(storageKey)==='light'?'light':'dark';}catch{return 'dark';}}
function applyTheme(mode:ThemeMode){
 document.documentElement.dataset.theme=mode;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#141415':'#f1f2f4');
}
const initial=initialTheme();applyTheme(initial);
export const useThemeStore=create<{mode:ThemeMode;setTheme:(mode:ThemeMode)=>void}>(set=>({
 mode:initial,setTheme:mode=>{try{localStorage.setItem(storageKey,mode);}catch{/* Keep switching available when storage is blocked. */}applyTheme(mode);set({mode});},
}));
