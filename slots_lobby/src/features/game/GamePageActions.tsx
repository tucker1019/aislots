import {FavoriteStar} from '../../components/FavoriteStar';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { overlayContainer } from '../../app/designViewport';
import { AsyncButton } from '../../components/buttons/AsyncButton';
import { useSessionStore } from '../../stores/session';
import { useGameFavorites, gameFavoritesKey } from '../home/useGameFavorites';
import { setGameFavorite } from '../../services/game-favorites';
import { gameShareUrl } from '../../services/game-share';
import {ShareSheet} from '../../components/share/ShareSheet';
import { t } from '../../i18n';

export function GamePageActions({gameId,title}:{gameId:string;title:string}) {
 const favorites = useGameFavorites(); const uid = useSessionStore(state=>state.session?.uid); const client=useQueryClient();
 const [toast,holder] = message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 const selected=favorites.data?.includes(gameId)??false;
 const favoriteLock=useRef(false); const [sharing,setSharing]=useState(false);
 const mutation=useMutation({mutationFn:(favorite:boolean)=>setGameFavorite(gameId,favorite),retry:false,onSuccess:ids=>{client.setQueryData(gameFavoritesKey(uid),ids);},onError:()=>{void toast.error(t('favorites.failed'));}});
 async function favorite() {
  if(favoriteLock.current)return; favoriteLock.current=true;
  try {
   if(!favorites.data){const result=await favorites.refetch();if(result.isError)void toast.error(t('favorites.failed'));return;}
   await mutation.mutateAsync(!selected);
  } catch { /* The mutation displays the shared toast and preserves confirmed state. */ }
  finally { favoriteLock.current=false; }
 }
 return <div className="game-page-actions">{holder}
  <AsyncButton type="button" loading={mutation.isPending||(favorites.isError&&favorites.isFetching)} disabled={favorites.isPending||favorites.isFetching} aria-label={t(favorites.isError?'favorites.retry':selected?'favorites.remove':'favorites.add')} aria-pressed={favorites.data?selected:undefined} title={t(selected?'favorites.remove':'favorites.add')} onClick={()=>void favorite()}><FavoriteStar/></AsyncButton>
  <AsyncButton type="button" loading={false} aria-label={t('gamePreview.share')} title={t('gamePreview.share')} onClick={()=>setSharing(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v5C8 8 4 12 2 19c4-4 7-5 12-5v5l8-8-8-8Z"/></svg></AsyncButton>
 <ShareSheet content={sharing?{url:gameShareUrl(gameId),kind:'game',name:title}:null} onClose={()=>setSharing(false)}/>
 </div>;
}
