import {defaultPromotions,promotionImage} from './default-promotions';
import {useQuery} from '@tanstack/react-query';
import {getLanguage} from '../../i18n/config';
import {fetchLobbyContent} from '../../services/lobby-content';
import type {LobbyContent} from '../../services/lobby-content';
function fallback():LobbyContent{
 const zh=getLanguage('zh-TW').messages,en=getLanguage('en-US').messages,id=getLanguage('id-ID').messages;
 return{announcements:{'zh-TW':[zh['copy.welcomeToAislotsEnjoyYourGames']],'en-US':[en['copy.welcomeToAislotsEnjoyYourGames']],'id-ID':[id['copy.welcomeToAislotsEnjoyYourGames']]},banners:defaultPromotions.map(b=>({id:b.id,enabled:true,imageZhTw:promotionImage(b.asset,'zh-tw'),imageEnUs:promotionImage(b.asset,'en'),altZhTw:zh[b.key],altEnUs:en[b.key],route:b.route}))};
}
const defaultContent=fallback();
export function useLobbyContent(){
 // Public content can finish and populate the shared cache across StrictMode remounts.
 const query=useQuery<LobbyContent>({queryKey:['lobby','display-content'],queryFn:()=>fetchLobbyContent(),placeholderData:defaultContent,staleTime:300000,retry:false,refetchOnWindowFocus:false});
 return{...query,data:query.data??defaultContent};
}
