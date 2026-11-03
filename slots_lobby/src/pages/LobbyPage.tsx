import { RebateRulesPage } from './RebateRulesPage';
import { EarnPage } from './EarnPage';
import { VipPage } from './VipPage';
import { WalletLedgerPage } from './WalletLedgerPage';
import { BenefitsPage } from './BenefitsPage';
import { BetRecordsPage } from './BetRecordsPage';
import { CashRecordsPage } from './CashRecordsPage';
import { GamePage } from './GamePage';
import { DepositPage } from './DepositPage';
import { useLobbyRoute } from '../app/useLobbyRoute';
import { MyAccount } from '../features/account/MyAccount';
import { message } from 'antd';
import { Header } from '../components/Header';
import { BottomNavigation } from '../components/BottomNavigation';
import { HomeContent } from '../features/home/HomeContent';

export function LobbyPage() {
  const { view, navigate, orderId } = useLobbyRoute();
  const comingSoon = () => { void toast.info({ key: 'lobby-notice', content: '敬请期待' }); };
  const [toast, contextHolder] = message.useMessage({
    top: view !== 'home' ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : 'calc(var(--header-height) + 12px)', duration: 1.6, maxCount: 1,
    classNames: { list: 'lobby-toast-list' },
  });
  if (view === 'game') return <GamePage onBack={() => navigate('home')} />;
  return <>
    {view === 'home' && <Header />}
    {contextHolder}
    <main key={view} className={`lobby-page-transition home-content${view !== 'home' ? ' account-route' : ''}${['records', 'bet-records', 'wallet-ledger', 'earn-rules'].includes(view) ? ' records-route' : ''}`} aria-label="大厅内容">
      {view === 'earn-rules' ? <RebateRulesPage onBack={() => navigate('earn')} /> : view === 'earn' ? <EarnPage /> : view === 'vip' || view === 'vip-details' ? <VipPage tables={view === 'vip-details'} onBack={() => navigate(view === 'vip-details' ? 'vip' : 'benefits')} onTables={() => navigate('vip-details')} /> : view === 'wallet-ledger' ? <WalletLedgerPage id={orderId} onBack={() => navigate('my')} /> : view === 'benefits' ? <BenefitsPage onBack={() => navigate('my')} onComingSoon={comingSoon} onVip={() => navigate('vip')} /> : view === 'bet-records' ? <BetRecordsPage onBack={() => navigate('my')} /> : view === 'records' ? <CashRecordsPage orderId={orderId} onBack={() => navigate('my')} onComingSoon={comingSoon} /> : view === 'deposit' ? <DepositPage /> : view === 'my' ? <MyAccount onAction={comingSoon} onDeposit={() => navigate('deposit')} onRecords={() => navigate('records')} onBetRecords={() => navigate('bet-records')} onBenefits={() => navigate('benefits')} onLedger={() => navigate('wallet-ledger')} /> : <HomeContent onToast={text => { void toast.info({ key: 'lobby-notice', content: text }); }} />}
    </main>
    {view !== 'earn-rules' && view !== 'vip' && view !== 'vip-details' && view !== 'records' && view !== 'bet-records' && view !== 'benefits' && view !== 'wallet-ledger' && <BottomNavigation view={view} onNavigate={navigate} onComingSoon={() => { void toast.info({ key: 'lobby-notice', content: '敬请期待' }); }} />}
  </>;
}
