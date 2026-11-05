import zhTW from 'antd/locale/zh_TW';
import enUS from 'antd/locale/en_US';
import zh from './locales/zh-TW.json';
import en from './locales/en-US.json';
// Add a catalog, Ant Design locale and language label here to register a language.
export const languages = [
  {id:'zh-TW',labelKey:'language.chinese',messages:zh,antd:zhTW},
  {id:'en-US',labelKey:'language.english',messages:en,antd:enUS},
] as const;
export type Locale=typeof languages[number]['id'];
export type MessageKey=keyof typeof zh;
export const getLanguage=(locale:Locale)=>languages.find(item=>item.id===locale)??languages[0];
export function isLocale(value:unknown):value is Locale{return languages.some(item=>item.id===value);}

export function resolveLocale(value:unknown):Locale{return isLocale(value)?value:'zh-TW';}
