import { create } from 'zustand';
import zh from './locales/zh-TW.json';
import { getLanguage, isLocale, resolveLocale } from './config';
import type { Locale, MessageKey } from './config';
export type { Locale, MessageKey } from './config';
const storageKey='aislots-language';
function initialLocale():Locale { try { const saved=localStorage.getItem(storageKey);const locale=resolveLocale(saved);if(saved==='zh-CN')localStorage.setItem(storageKey,locale);return locale; } catch { return 'zh-TW'; } }
export const useLanguageStore=create<{locale:Locale;setLocale:(locale:Locale)=>void}>(set=>({locale:initialLocale(),setLocale:locale=>{
  if (!isLocale(locale)) return;
  try {localStorage.setItem(storageKey,locale);}catch{/* Language switching remains available when storage is blocked. */}
  document.documentElement.lang=locale;
  set({locale});
}}));
export const getLocale=()=>useLanguageStore.getState().locale;
export function t(key:MessageKey,params:Record<string,string|number>={}):string {
  return (getLanguage(getLocale()).messages[key]??zh[key]).replace(/\{(\w+)\}/g,(match,name:string)=>params[name]===undefined?match:String(params[name]));
}
