import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AgentPage} from './AgentPage';
import type * as AgentModule from '../services/agent';
import {agentSummaryKeys,fetchAgent,claimAgent,type AgentData,type AgentSummary} from '../services/agent';
vi.mock('../services/agent',async importOriginal=>({...await importOriginal<typeof AgentModule>(),fetchAgent:vi.fn(),claimAgent:vi.fn()}));
const base:AgentData={summary:Object.fromEntries(agentSummaryKeys.map(k=>[k,0])) as AgentSummary,items:[],hasMore:false,from:'2026-11-04T00:00:00Z',to:'2026-11-05T00:00:00Z',timezone:'Asia/Shanghai',status:'preview',updatedAt:'',providers:['AG'],inviteUrl:'https://example.com/?inviteCode=test',account:'player'};
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><AgentPage onBack={vi.fn()}/></QueryClientProvider>);}
beforeEach(()=>{vi.mocked(fetchAgent).mockReset();vi.mocked(claimAgent).mockReset();window.history.replaceState({},'','/agent');});
it('does not claim a zero balance or show removed share channels',async()=>{
 vi.mocked(fetchAgent).mockResolvedValue(base);mount();expect(await screen.findByRole('button',{name:'領取'})).toBeDisabled();expect(screen.queryByText('防封鏈接')).not.toBeInTheDocument();expect(screen.queryByText('微信')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'更多信息 ›'}));expect(await screen.findByText('暫無數據')).toBeInTheDocument();expect(window.location.search).toContain('view=team');
});
it('claims settled rewards once and displays confirmation',async()=>{
 vi.mocked(fetchAgent).mockResolvedValue({...base,summary:{...base.summary,claimable:232000}});vi.mocked(claimAgent).mockResolvedValue({claimId:'claim',amount:232000,coins:232000});mount();fireEvent.click(await screen.findByRole('button',{name:'領取'}));expect(await screen.findByText('傭金領取成功')).toBeInTheDocument();expect(claimAgent).toHaveBeenCalledTimes(1);
});
it('query errors show retry, never a fake zero commission',async()=>{
 vi.mocked(fetchAgent).mockRejectedValue(new Error('offline'));mount();expect(await screen.findByRole('alert')).toHaveTextContent('網絡異常，請重試');expect(screen.queryByRole('button',{name:'領取'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'重試'})).toBeInTheDocument();
});
