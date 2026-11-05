import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PersonalReportPage} from './PersonalReportPage';
import {fetchPersonalReport,parsePersonalReport} from '../services/personal-report';
import type * as ReportModule from '../services/personal-report';
vi.mock('../services/personal-report',async original=>({...await original<typeof ReportModule>(),fetchPersonalReport:vi.fn()}));
const fixture={items:[{key:'recharge',label:'充值金額',amount:10000,supported:true},{key:'withdrawal',label:'取款金額',amount:0,supported:false},{key:'rechargeBonus',label:'充值贈送',amount:200,supported:true},{key:'netProfit',label:'淨輸贏',amount:-500,supported:true}],from:'2026-11-02T17:00:00Z',to:'2026-11-03T17:00:00Z',timezone:'Asia/Jakarta',currency:'IDR'};
beforeEach(()=>vi.mocked(fetchPersonalReport).mockReset());
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><PersonalReportPage onBack={vi.fn()} /></QueryClientProvider>);}
it('本金和贈送獨立展示，未實現項目留空，篩選使用服務端週期',async()=>{
 vi.mocked(fetchPersonalReport).mockResolvedValue(fixture);setup();
 expect(await screen.findByText('100.00')).toBeInTheDocument();expect(screen.getByText('2.00')).toBeInTheDocument();expect(screen.getByText('—')).toBeInTheDocument();expect(screen.getByText('-5.00')).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'個人報表'}).closest('.records-page-top')).toContainElement(screen.getByRole('navigation',{name:'報表時間'}));
 for(const label of ['昨天','本週','上周']){fireEvent.click(screen.getByRole('button',{name:label}));await screen.findByText('100.00');}
 expect(vi.mocked(fetchPersonalReport).mock.calls.map(row=>row[0])).toEqual(['today','yesterday','this_week','last_week']);
});
it('加載失敗可以重試，不展示偽造的零金額',async()=>{
 vi.mocked(fetchPersonalReport).mockRejectedValueOnce(new Error('network')).mockResolvedValue(fixture);setup();
 const alert=await screen.findByRole('alert');expect(within(alert).getByText('網絡異常，請重試')).toBeInTheDocument();expect(screen.queryByText('0.00')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByText('100.00')).toBeInTheDocument();
});
it('響應拒絕不安全金額、重復指標及反向日期',()=>{
 expect(parsePersonalReport(fixture).items[0].amount).toBe(10000);
 expect(()=>parsePersonalReport({...fixture,items:[...fixture.items,fixture.items[0]]})).toThrow();
 expect(()=>parsePersonalReport({...fixture,items:[{...fixture.items[0],amount:Number.MAX_SAFE_INTEGER+1}]})).toThrow();
 expect(()=>parsePersonalReport({...fixture,to:fixture.from})).toThrow();
});
