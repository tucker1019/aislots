import {useEffect,useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useSessionStore} from '../../stores/session';
import {useLobbyRoute} from '../../app/useLobbyRoute';
import {useIndicatorQueries} from './useClaimIndicators';
/** Reload eligibility after game turnover changes, never on ordinary tab navigation. */
export function ClaimIndicatorsSync(){
 useIndicatorQueries(true);
 const uid=useSessionStore(state=>state.session?.uid);
 const {view}=useLobbyRoute();const client=useQueryClient();
 const previous=useRef({uid,view});
 useEffect(()=>{
  if(uid&&previous.current.uid===uid&&previous.current.view==='game'&&view!=='game'){
   void client.invalidateQueries({queryKey:['claim-indicators',uid]});
  }
  previous.current={uid,view};
 },[uid,view,client]);
 return null;
}
