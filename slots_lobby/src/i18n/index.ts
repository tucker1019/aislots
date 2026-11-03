import { create } from 'zustand';
import zh from './locales/zh-CN.json';
import { getLanguage, isLocale } from './config';
import type { Locale, MessageKey } from './config';
export type { Locale, MessageKey } from './config';
const storageKey='aislots-language';
function initialLocale():Locale { try { const saved=localStorage.getItem(storageKey);return isLocale(saved)?saved:'zh-CN'; } catch { return 'zh-CN'; } }
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
// Only call this for server-owned UI labels, never for usernames or user content.
const serverKeys=new Map<string,MessageKey>(Object.entries(zh).map(([key,value])=>[value,key as MessageKey]));
export function serverText(label:string):string { const key=serverKeys.get(label);if(key)return t(key);
  for(const suffix of ['server.bet','server.payout'] as const){
    const ending=' '+zh[suffix];
    if(label.endsWith(ending))return label.slice(0,-ending.length)+' '+t(suffix);
  }
  return label; }
