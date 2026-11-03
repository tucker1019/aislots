import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import zh from './locales/zh-CN.json';
import en from './locales/en-US.json';
// Add a catalog, Ant Design locale and language label here to register a language.
export const languages = [
  {id:'zh-CN',labelKey:'language.chinese',messages:zh,antd:zhCN},
  {id:'en-US',labelKey:'language.english',messages:en,antd:enUS},
] as const;
export type Locale=typeof languages[number]['id'];
export type MessageKey=keyof typeof zh;
export const getLanguage=(locale:Locale)=>languages.find(item=>item.id===locale)??languages[0];
export function isLocale(value:unknown):value is Locale{return languages.some(item=>item.id===value);}
