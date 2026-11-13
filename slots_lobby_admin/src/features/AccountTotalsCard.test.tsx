import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {AccountTotalsCard} from './AccountTotalsCard';
afterEach(cleanup);
it('shows member count and exact bet/win values for each account kind',()=>{
 render(<><AccountTotalsCard title="普通用户" members={2} bet="900719925474099312345" win="5"/><AccountTotalsCard title="体验账号" members={8} bet="0" win="100"/></>);
 expect(screen.getByText('普通用户')).toBeTruthy();expect(screen.getByText('体验账号')).toBeTruthy();
 expect(screen.getByText('9,007,199,254,740,993,123.45')).toBeTruthy();expect(screen.getByText('0.05')).toBeTruthy();expect(screen.getByText('0.00')).toBeTruthy();
 expect(screen.getAllByText('总 Bet · 投注')).toHaveLength(2);expect(screen.getAllByText('总 Win · 派彩')).toHaveLength(2);
});

it('calculates each group RTP independently with exact large integers and zero-bet fallback',()=>{
 render(<><AccountTotalsCard title="普通用户" members={2} bet="300" win="200"/><AccountTotalsCard title="体验账号" members={3} bet="90071992547409931234500" win="87369832770987633297465"/><AccountTotalsCard title="无投注" members={0} bet="0" win="0"/></>);
 expect(screen.getByText('66.67%')).toBeTruthy();expect(screen.getByText('97.00%')).toBeTruthy();expect(screen.getByText('—')).toBeTruthy();
});
