import {navigateLobby} from '../../app/useLobbyRoute';
import {expect,it,vi} from 'vitest';
import {render,waitFor,act} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ClaimIndicatorsSync} from './ClaimIndicatorsSync';
import {useClaimIndicators} from './useClaimIndicators';
import {useSessionStore} from '../../stores/session';
import {loadIndicator} from './claimIndicators';
import type * as Indicators from './claimIndicators';
vi.mock('./claimIndicators',async original=>({...await original<typeof Indicators>(),loadIndicator:vi.fn(async()=>({}))}));
function Page({view}:{view:string}){useClaimIndicators();return <span>{view}</span>;}
it('同账号切换底栏及重新挂载入口不重查领奖接口',async()=>{
 useSessionStore.setState({session:{uid:7,sid:'A'.repeat(52),expiresAt:'2030-01-01'}});
 vi.mocked(loadIndicator).mockClear();
 const client=new QueryClient();
 const tree=(view:string)=><QueryClientProvider client={client}><ClaimIndicatorsSync/><Page key={view} view={view}/></QueryClientProvider>;
 const {rerender}=render(tree('home'));await waitFor(()=>expect(loadIndicator).toHaveBeenCalledTimes(6));
 for(const view of ['earn','my','home'] as const){await act(async()=>navigateLobby(view));rerender(tree(view));await waitFor(()=>expect(client.isFetching()).toBe(0));expect(loadIndicator).toHaveBeenCalledTimes(6);}
 await waitFor(()=>expect(client.isFetching()).toBe(0));expect(loadIndicator).toHaveBeenCalledTimes(6);
});

it('只在从游戏回大厅时额外刷新一次',async()=>{
 window.history.replaceState({},'','/');
 useSessionStore.setState({session:{uid:7,sid:'A'.repeat(52),expiresAt:'2030-01-01'}});vi.mocked(loadIndicator).mockClear();
 const client=new QueryClient();render(<QueryClientProvider client={client}><ClaimIndicatorsSync/></QueryClientProvider>);
 await waitFor(()=>expect(loadIndicator).toHaveBeenCalledTimes(6));await waitFor(()=>expect(client.isFetching()).toBe(0));
 await act(async()=>navigateLobby('game'));expect(loadIndicator).toHaveBeenCalledTimes(6);
 await act(async()=>navigateLobby('home'));await waitFor(()=>expect(loadIndicator).toHaveBeenCalledTimes(12));
 await act(async()=>navigateLobby('my'));await waitFor(()=>expect(client.isFetching()).toBe(0));expect(loadIndicator).toHaveBeenCalledTimes(12);
});
