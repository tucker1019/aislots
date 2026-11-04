import {useQueryClient} from '@tanstack/react-query';
import {useSessionStore} from '../../stores/session';
import type {UserProfile} from '../account/types';
export function useProfileUpdate(){
 const client=useQueryClient();
 return async(uid:number,patch:Partial<UserProfile>)=>{
  await client.cancelQueries({queryKey:['lobby','current-profile']});
  if(useSessionStore.getState().session?.uid!==uid)return;
  client.setQueryData<UserProfile>(['lobby','current-profile'],old=>old?.uid===uid?{...old,...patch}:old);
  void client.invalidateQueries({queryKey:['lobby','current-profile']});
  void client.invalidateQueries({queryKey:['game-leaderboard'],refetchType:'none'});
 };
}
