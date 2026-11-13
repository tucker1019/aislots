import {Card, Statistic} from 'antd';
import {money, rtp} from '../services/format';
interface Props {title:string;members:number;bet:string;win:string}
export function AccountTotalsCard({title,members,bet,win}:Props) {
 return <Card className="account-totals"><Statistic title={title} value={members} suffix="人"/>
 <dl><div><dt>总 Bet · 投注</dt><dd>{money(bet)}</dd></div><div><dt>总 Win · 派彩</dt><dd>{money(win)}</dd></div><div><dt>RTP</dt><dd>{rtp(bet,win)}</dd></div></dl></Card>;
}
