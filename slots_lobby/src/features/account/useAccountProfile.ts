import {useSessionStore} from '../../stores/session';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadAccountProfile } from '../../services/account';
export function useAccountProfile(refreshOnMount = false) {
  const session=useSessionStore(state=>state.session);
  const query = useQuery({
    enabled:!!session,
    queryKey: ['lobby', 'current-profile',session?.uid], queryFn: ({ signal }) => loadAccountProfile(signal),
    refetchOnMount: refreshOnMount ? 'always' : true, retry: false, staleTime: 15000, refetchOnWindowFocus: true,
  });
  const { refetch } = query;
  useEffect(() => {
    // 从AG1返回可能恢复浏览器页面缓存；即使资料仍在15秒新鲜期，也必须重新读取大厅余额。
    const restore = (event: PageTransitionEvent) => { if (event.persisted) void refetch(); };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [refetch]);
  return query;
}
