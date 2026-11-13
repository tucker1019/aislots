import {AccountTotalsCard} from '../features/AccountTotalsCard';
import { useQuery } from '@tanstack/react-query';
import { Card, Statistic } from 'antd';
import { getOverview } from '../services/admin';
import { money } from '../services/format';
import { Page } from '../components/Page';
import { QueryState } from '../components/QueryState';
import { AsyncButton } from '../components/AsyncButton';
import { useConsole } from '../features/session';
export function Overview() {
 const query = useQuery({ queryKey: ['overview'], queryFn: getOverview }); const navigate = useConsole(s => s.navigate);
 return <Page eyebrow="OPERATIONS OVERVIEW" title="运营总览" description="掌握大厅当前状态，优先处理待办事项。" tools={<AsyncButton loading={query.isRefetching} onClick={() => void query.refetch()}>刷新数据</AsyncButton>}>
 <QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
 {query.data && <><div className="stats"><AccountTotalsCard title="普通用户" members={query.data.realMembers} bet={query.data.realBet} win={query.data.realWin}/><AccountTotalsCard title="体验账号" members={query.data.experienceMembers} bet={query.data.experienceBet} win={query.data.experienceWin}/><Card className="attention"><Statistic title="待处理充值" value={query.data.pendingDeposits} /></Card><Card className="attention"><Statistic title="待处理提现" value={query.data.pendingWithdrawals} /></Card><Card><Statistic title="今日充值 · 金额" value={money(query.data.todayDeposits)} /></Card><Card><Statistic title="今日提现 · 金额" value={money(query.data.todayWithdrawals)} /></Card></div>
 <div className="overview-grid"><Card title="工作台入口"><div className="quick-links"><button onClick={() => navigate('orders')}><strong>资金订单</strong><span>查看充值、提现及人工审核 →</span></button><button onClick={() => navigate('configs')}><strong>大厅配置</strong><span>编辑草稿、校验与版本发布 →</span></button><button onClick={() => navigate('members')}><strong>会员资料</strong><span>查询账户、钱包与近期账变 →</span></button></div></Card><Card title="运营提示"><p>所有金额以原订单为准，界面显示两位小数。</p><p>提现「审核通过」仅代表审核完成，实际打款请遵循财务流程。</p><p>配置发布与资金审核会记录管理员、理由和时间，可在审计日志中追溯。</p></Card></div></>}
 </Page>;
}
