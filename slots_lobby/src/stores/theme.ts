import {create} from 'zustand';
export type ThemeMode='light'|'dark';
const storageKey='aislots-theme';
function initialTheme():ThemeMode{try{return localStorage.getItem(storageKey)==='dark'?'dark':'light';}catch{return 'light';}}
function applyTheme(mode:ThemeMode){
 document.documentElement.dataset.theme=mode;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#111923':'#ffffff');
}
const initial=initialTheme();applyTheme(initial);
export const useThemeStore=create<{mode:ThemeMode;setTheme:(mode:ThemeMode)=>void}>(set=>({
 mode:initial,setTheme:mode=>{try{localStorage.setItem(storageKey,mode);}catch{/* Keep switching available when storage is blocked. */}applyTheme(mode);set({mode});},
}));
