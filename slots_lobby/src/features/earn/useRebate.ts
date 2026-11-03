import { useQuery } from '@tanstack/react-query';
import { fetchRebate } from '../../services/rebate';
import { useSessionStore } from '../../stores/session';
export function useRebate() {
 const uid=useSessionStore(state=>state.session?.uid);
 return useQuery({queryKey:['lobby','rebate',uid],queryFn:({signal})=>fetchRebate(signal),retry:false,staleTime:15000,refetchOnWindowFocus:false});
}
