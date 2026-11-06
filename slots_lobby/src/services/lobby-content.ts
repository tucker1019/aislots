import {request} from './account';
import {isRecord} from '../features/account/types';
import {t} from '../i18n';
export type ContentRoute='/'|'/earn'|'/deposit'|'/offers';
export interface ContentBanner{id:string;enabled:boolean;imageZhTw:string;imageEnUs:string;altZhTw:string;altEnUs:string;route:ContentRoute}
export interface LobbyContent{announcements:Record<'zh-TW'|'en-US',string[]>;banners:ContentBanner[]}
function image(v:unknown):v is string{
 if(typeof v!=='string')return false;
 if(v.startsWith('/assets/'))return !/[\\%?#\r\n]/.test(v)&&new URL(v,'https://local.example').pathname===v;
 try{const u=new URL(v);return u.protocol==='https:'&&!!u.host&&!u.username&&!u.password&&!u.hash&&v.length<=2048;}catch{return false;}
}
export function parseLobbyContent(value:unknown):LobbyContent{
 const bad=()=>new Error(t('copy.invalidLobbyResponsePleaseRetry'));
 if(!isRecord(value)||!Array.isArray(value.announcements)||!Array.isArray(value.banners)||value.announcements.length!==2||value.banners.length>20)throw bad();
 const announcements:LobbyContent['announcements']={'zh-TW':[],'en-US':[]};const locales=new Set<string>();
 for(const item of value.announcements){if(!isRecord(item)||(item.locale!=='zh-TW'&&item.locale!=='en-US')||locales.has(item.locale)||!Array.isArray(item.items)||item.items.length>20||!item.items.every(v=>typeof v==='string'&&v.trim().length>0&&v.length<=1000))throw bad();locales.add(item.locale);announcements[item.locale]=item.items;}
 const ids=new Set<string>();const routes:readonly string[]=['/','/earn','/deposit','/offers'];
 const banners=value.banners.map((b:unknown):ContentBanner=>{
  if(!isRecord(b)||typeof b.id!=='string'||!b.id||b.id.length>64||ids.has(b.id)||typeof b.enabled!=='boolean'||!image(b.imageZhTw)||!image(b.imageEnUs)||typeof b.altZhTw!=='string'||!b.altZhTw.trim()||b.altZhTw.length>400||typeof b.altEnUs!=='string'||!b.altEnUs.trim()||b.altEnUs.length>400||typeof b.route!=='string'||!routes.includes(b.route))throw bad();ids.add(b.id);
  return{id:b.id,enabled:b.enabled,imageZhTw:b.imageZhTw,imageEnUs:b.imageEnUs,altZhTw:b.altZhTw,altEnUs:b.altEnUs,route:b.route as ContentRoute};
 });
 return{announcements,banners};
}
export async function fetchLobbyContent(signal?:AbortSignal){return parseLobbyContent(await request('/api/lobby/content',{signal},t('copy.unableToConnectToTheLobbyPlease')));}
