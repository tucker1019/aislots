import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PersonalReportPage} from './PersonalReportPage';
import {fetchPersonalReport,parsePersonalReport} from '../services/personal-report';
import type * as ReportModule from '../services/personal-report';
vi.mock('../services/personal-report',async original=>({...await original<typeof ReportModule>(),fetchPersonalReport:vi.fn()}));
const fixture={items:[{key:'recharge',label:'充值金额',amount:10000,supported:true},{key:'withdrawal',label:'取款金额',amount:0,supported:false},{key:'rechargeBonus',label:'充值赠送',amount:200,supported:true},{key:'netProfit',label:'净输赢',amount:-500,supported:true}],from:'2026-11-02T17:00:00Z',to:'2026-11-03T17:00:00Z',timezone:'Asia/Jakarta',currency:'IDR'};
beforeEach(()=>vi.mocked(fetchPersonalReport).mockReset());
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><PersonalReportPage onBack={vi.fn()} /></QueryClientProvider>);}
it('本金和赠送独立展示，未实现项目留空，筛选使用服务端周期',async()=>{
 vi.mocked(fetchPersonalReport).mockResolvedValue(fixture);setup();
 expect(await screen.findByText('100.00')).toBeInTheDocument();expect(screen.getByText('2.00')).toBeInTheDocument();expect(screen.getByText('—')).toBeInTheDocument();expect(screen.getByText('-5.00')).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'个人报表'}).closest('.records-page-top')).toContainElement(screen.getByRole('navigation',{name:'报表时间'}));
 for(const label of ['昨天','本周','上周']){fireEvent.click(screen.getByRole('button',{name:label}));await screen.findByText('100.00');}
 expect(vi.mocked(fetchPersonalReport).mock.calls.map(row=>row[0])).toEqual(['today','yesterday','this_week','last_week']);
});
it('加载失败可以重试，不展示伪造的零金额',async()=>{
 vi.mocked(fetchPersonalReport).mockRejectedValueOnce(new Error('network')).mockResolvedValue(fixture);setup();
 const alert=await screen.findByRole('alert');expect(within(alert).getByText('网络异常，请重试')).toBeInTheDocument();expect(screen.queryByText('0.00')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'重试'}));expect(await screen.findByText('100.00')).toBeInTheDocument();
});
it('响应拒绝不安全金额、重复指标及反向日期',()=>{
 expect(parsePersonalReport(fixture).items[0].amount).toBe(10000);
 expect(()=>parsePersonalReport({...fixture,items:[...fixture.items,fixture.items[0]]})).toThrow();
 expect(()=>parsePersonalReport({...fixture,items:[{...fixture.items[0],amount:Number.MAX_SAFE_INTEGER+1}]})).toThrow();
 expect(()=>parsePersonalReport({...fixture,to:fixture.from})).toThrow();
});
