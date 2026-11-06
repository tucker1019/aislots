import {beforeEach,expect,it} from 'vitest';
import {render,screen,act,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BottomNavigation} from '../../components/BottomNavigation';
import {useSessionStore} from '../../stores/session';
import {indicatorKey} from './claimIndicators';
beforeEach(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));
it('子奖励变化同步父入口，未登录不显示缓存的红点',async()=>{
 const client=new QueryClient();client.setQueryData(indicatorKey(7,'checkin'),{checkin:1});client.setQueryData(indicatorKey(7,'rebate'),{rebate:100});
 render(<QueryClientProvider client={client}><BottomNavigation view="home" onNavigate={()=>{}}/></QueryClientProvider>);
 expect(document.querySelectorAll('.claim-badge')).toHaveLength(2);
 await act(async()=>{client.setQueryData(indicatorKey(7,'rebate'),{rebate:0});});await waitFor(()=>expect(document.querySelectorAll('.claim-badge')).toHaveLength(1));
 expect(screen.getByRole('button',{name:'我的'}).querySelector('.claim-badge')).not.toBeNull();
 await act(async()=>useSessionStore.getState().clearSession());expect(document.querySelectorAll('.claim-badge')).toHaveLength(0);
});
