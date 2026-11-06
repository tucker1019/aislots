import {useQueries} from '@tanstack/react-query';
import {useSessionStore} from '../../stores/session';
import {aggregateIndicators,groups,indicatorKey,loadIndicator} from './claimIndicators';
export function useIndicatorQueries(fetch:boolean){
 const uid=useSessionStore(state=>state.session?.uid);
 return useQueries({queries:groups.map(group=>({queryKey:indicatorKey(uid??0,group),queryFn:({signal}:{signal:AbortSignal})=>loadIndicator(group,signal),enabled:fetch&&!!uid,retry:false,staleTime:Infinity,refetchOnWindowFocus:false,refetchOnReconnect:false,refetchInterval:false as const}))});
}
export function useClaimIndicators(){
 const uid=useSessionStore(state=>state.session?.uid);const queries=useIndicatorQueries(false);
 return aggregateIndicators(uid?queries.map(query=>query.data??{}):[]);
}
