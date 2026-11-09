import {useQuery} from '@tanstack/react-query';
import {getLanguage} from '../../i18n/config';
import {fetchLobbyContent} from '../../services/lobby-content';
import type {LobbyContent} from '../../services/lobby-content';
function fallback():LobbyContent{
 const zh=getLanguage('zh-TW').messages,en=getLanguage('en-US').messages;
 const banners=[{id:'referral',asset:'referral-200',key:'promotion.referral',route:'/earn'},{id:'deposit',asset:'deposit-bonus-5',key:'promotion.deposit',route:'/deposit'},{id:'cashback',asset:'cashback-1',key:'promotion.cashback',route:'/earn'}] as const;
 return{announcements:{'zh-TW':[zh['copy.welcomeToAislotsEnjoyYourGames']],'en-US':[en['copy.welcomeToAislotsEnjoyYourGames']]},banners:banners.map(b=>({id:b.id,enabled:true,imageZhTw:`/assets/lobby/promotions/${b.asset}-zh-tw-v1.webp`,imageEnUs:`/assets/lobby/promotions/${b.asset}-en-v1.webp`,altZhTw:zh[b.key],altEnUs:en[b.key],route:b.route}))};
}
const defaultContent=fallback();
export function useLobbyContent(){
 // Public content can finish and populate the shared cache across StrictMode remounts.
 const query=useQuery<LobbyContent>({queryKey:['lobby','display-content'],queryFn:()=>fetchLobbyContent(),placeholderData:defaultContent,staleTime:300000,retry:false,refetchOnWindowFocus:false});
 return{...query,data:query.data??defaultContent};
}
