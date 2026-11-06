import {SecurityPage} from './SecurityPage';
import {useEffect} from 'react';
import {useAuthStore} from '../stores/auth';
import {useSessionStore} from '../stores/session';
import { overlayContainer } from '../app/designViewport';
import { OffersPage } from './OffersPage';
import { LossReturnRulesPage } from './LossReturnRulesPage';
import {ProfilePage} from './ProfilePage';
import {WithdrawalPage} from './WithdrawalPage';
import { WalletManagementPage } from './WalletManagementPage';
import {AgentPage} from './AgentPage';
import {InviteFriendsPage} from './InviteFriendsPage';
import { InvitePage } from './InvitePage';
import { t, useLanguageStore } from '../i18n';
import { PersonalReportPage } from './PersonalReportPage';
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
  useLanguageStore(state=>state.locale);
  const { view:requestedView, navigate, orderId } = useLobbyRoute();
  const session=useSessionStore(state=>state.session);
  const restricted=!session&&!['home','offers'].includes(requestedView);
  const view=restricted?'home':requestedView;
  useEffect(()=>{if(restricted)useAuthStore.getState().show('login',()=>navigate(requestedView,{orderId}));},[restricted,requestedView,navigate,orderId]);
  const comingSoon = () => { void toast.info({ key: 'lobby-notice', content: t('copy.comingSoon') }); };
  const [toast, contextHolder] = message.useMessage({getContainer:overlayContainer,
    top: view !== 'home' ? 'calc(var(--lobby-safe-top, 0px) + 12px)' : 'calc(var(--header-height) + 12px)', duration: 1.6, maxCount: 1,
    classNames: { list: 'lobby-toast-list' },
  });
  if (view === 'game') return <GamePage onBack={() => navigate('home')} />;
  return <>
    {view === 'home' && <Header />}
    {contextHolder}
    <main key={view} className={`lobby-page-transition home-content${view !== 'home' ? ' account-route' : ''}${['security','password','profile', 'withdrawal', 'wallet-management', 'records', 'bet-records', 'wallet-ledger', 'earn-rules', 'loss-return-rules', 'personal-report', 'invite', 'invite-friends'].includes(view) ? ' records-route' : ''}`} aria-label={t('copy.lobbyContent')}>
      {view === 'security'||view === 'password'?<SecurityPage password={view==='password'} onSignedOut={changed=>{useSessionStore.getState().clearSession();navigate('home');void toast.success(changed?t('security.changed'):t('security.loggedOut'));if(changed)useAuthStore.getState().show('login');}}/>:view === 'offers' ? <OffersPage /> : view === 'loss-return-rules' ? <LossReturnRulesPage onBack={() => navigate('earn')} /> : view === 'profile' ? <ProfilePage onBack={() => navigate('my')}/> : view === 'withdrawal' ? <WithdrawalPage orderId={orderId} onBack={() => navigate('my')}/> : view === 'wallet-management' ? <WalletManagementPage onBack={() => navigate('my')} /> : view === 'agent' ? <AgentPage onBack={() => navigate('my')} /> : view === 'invite-friends' ? <InviteFriendsPage onBack={() => navigate('earn')} /> : view === 'invite' ? <InvitePage onBack={() => navigate('my')} /> : view === 'personal-report' ? <PersonalReportPage onBack={() => navigate('my')} /> : view === 'earn-rules' ? <RebateRulesPage onBack={() => navigate('earn')} /> : view === 'earn' ? <EarnPage /> : view === 'vip' || view === 'vip-details' ? <VipPage tables={view === 'vip-details'} onBack={() => navigate(view === 'vip-details' ? 'vip' : 'benefits')} onTables={() => navigate('vip-details')} /> : view === 'wallet-ledger' ? <WalletLedgerPage id={orderId} onBack={() => navigate('my')} /> : view === 'benefits' ? <BenefitsPage onBack={() => navigate('my')} onComingSoon={comingSoon} onVip={() => navigate('vip')} /> : view === 'bet-records' ? <BetRecordsPage onBack={() => navigate('my')} /> : view === 'records' ? <CashRecordsPage orderId={orderId} onBack={() => navigate('my')} onComingSoon={comingSoon} /> : view === 'deposit' ? <DepositPage /> : view === 'my' ? <MyAccount onSettings={() => navigate('profile')} onWithdraw={() => navigate('withdrawal')} onWallet={() => navigate('wallet-management')} onAgent={() => navigate('agent')} onAction={comingSoon} onDeposit={() => navigate('deposit')} onRecords={() => navigate('records')} onBetRecords={() => navigate('bet-records')} onBenefits={() => navigate('benefits')} onLedger={() => navigate('wallet-ledger')} onReport={() => navigate('personal-report')} onInvite={() => navigate('invite')} /> : <HomeContent />}
    </main>
    {view !== 'security' && view !== 'password' && view !== 'profile' && view !== 'withdrawal' && view !== 'wallet-management' && view !== 'agent' && view !== 'invite-friends' && view !== 'invite' && view !== 'personal-report' && view !== 'earn-rules' && view !== 'loss-return-rules' && view !== 'vip' && view !== 'vip-details' && view !== 'records' && view !== 'bet-records' && view !== 'benefits' && view !== 'wallet-ledger' && <BottomNavigation view={view} onNavigate={navigate} />}
  </>;
}
