import { forgetGameEntry } from '../services/game-entry';
import { useQueryClient } from '@tanstack/react-query';
import {SecurityPage} from './SecurityPage';
import {useEffect,useRef,useState} from 'react';
import type { GameId } from '../app/games';
import { MinimizedGameBar } from '../features/game/MinimizedGameBar';
import {useAuthStore} from '../stores/auth';
import {useSessionStore} from '../stores/session';
import { overlayContainer } from '../app/designViewport';
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
import { useLobbyRoute, returnToLobbySource } from '../app/useLobbyRoute';
import { MyAccount } from '../features/account/MyAccount';
import { message } from 'antd';
import { Header } from '../components/Header';
import { BottomNavigation } from '../components/BottomNavigation';
import { HomeContent } from '../features/home/HomeContent';

export function LobbyPage() {
  useLanguageStore(state=>state.locale);
  const queryClient=useQueryClient();
  const gameDockRef=useRef<HTMLElement>(null);
  const { view:requestedView, navigate, orderId, gameId } = useLobbyRoute();
  const session=useSessionStore(state=>state.session);
  const restricted=!session&&requestedView !== 'home';
  const view=restricted?'home':requestedView;
  useEffect(()=>{if(restricted)useAuthStore.getState().show('login',()=>navigate(requestedView,{orderId,gameId}));},[restricted,requestedView,navigate,orderId,gameId]);
  const [activeGame,setActiveGame]=useState<GameId | undefined>(()=>view==='game'?gameId:undefined);
  if(view==='game'&&activeGame!==gameId)setActiveGame(gameId);
  if(!session&&activeGame)setActiveGame(undefined);
  const comingSoon = () => { void toast.info({ key: 'lobby-notice', content: t('copy.comingSoon') }); };
  const [toast, contextHolder] = message.useMessage({getContainer:overlayContainer,
    top: view !== 'home' ? 'calc(var(--lobby-safe-top, 0px) + 12px)' : 'calc(var(--header-height) + 12px)', duration: 1.6, maxCount: 1,
    classNames: { list: 'lobby-toast-list' },
  });
  return <>
    {(view === 'home'||view === 'game') && <Header />}
    {contextHolder}
    <main inert={view==='game'} key={view==='game'?'home':view} className={`lobby-page-transition home-content${view !== 'home' && view !== 'game' ? ' account-route' : ''}${['security','password','profile', 'withdrawal', 'wallet-management', 'records', 'bet-records', 'wallet-ledger', 'earn-rules', 'loss-return-rules', 'personal-report', 'invite', 'invite-friends'].includes(view) ? ' records-route' : ''}`} aria-label={t('copy.lobbyContent')}>
      {view === 'security'||view === 'password'?<SecurityPage password={view==='password'} onSignedOut={changed=>{useSessionStore.getState().clearSession();navigate('home');void toast.success(changed?t('security.changed'):t('security.loggedOut'));if(changed)useAuthStore.getState().show('login');}}/>:view === 'loss-return-rules' ? <LossReturnRulesPage onBack={() => returnToLobbySource('earn')} /> : view === 'profile' ? <ProfilePage onBack={() => returnToLobbySource('my')}/> : view === 'withdrawal' ? <WithdrawalPage orderId={orderId} onBack={() => returnToLobbySource('my')}/> : view === 'wallet-management' ? <WalletManagementPage onBack={() => returnToLobbySource('my')} /> : view === 'agent' ? <AgentPage onBack={() => returnToLobbySource('my')} /> : view === 'invite-friends' ? <InviteFriendsPage onBack={() => returnToLobbySource('earn')} /> : view === 'invite' ? <InvitePage onBack={() => returnToLobbySource('my')} /> : view === 'personal-report' ? <PersonalReportPage onBack={() => returnToLobbySource('my')} /> : view === 'earn-rules' ? <RebateRulesPage onBack={() => returnToLobbySource('earn')} /> : view === 'earn' ? <EarnPage /> : view === 'vip' || view === 'vip-details' ? <VipPage tables={view === 'vip-details'} onBack={() => returnToLobbySource(view === 'vip-details' ? 'vip' : 'benefits')} onTables={() => navigate('vip-details')} /> : view === 'wallet-ledger' ? <WalletLedgerPage id={orderId} onBack={() => returnToLobbySource('my')} /> : view === 'benefits' ? <BenefitsPage onBack={() => returnToLobbySource('my')} onComingSoon={comingSoon} onVip={() => navigate('vip')} /> : view === 'bet-records' ? <BetRecordsPage onBack={() => returnToLobbySource('my')} /> : view === 'records' ? <CashRecordsPage orderId={orderId} onBack={() => returnToLobbySource('my')} onComingSoon={comingSoon} /> : view === 'deposit' ? <DepositPage /> : view === 'my' ? <MyAccount onSettings={() => navigate('profile')} onWithdraw={() => navigate('withdrawal')} onWallet={() => navigate('wallet-management')} onAgent={() => navigate('agent')} onAction={comingSoon} onDeposit={() => navigate('deposit')} onRecords={() => navigate('records')} onBetRecords={() => navigate('bet-records')} onBenefits={() => navigate('benefits')} onLedger={() => navigate('wallet-ledger')} onReport={() => navigate('personal-report')} onInvite={() => navigate('invite')} /> : <HomeContent onComingSoon={comingSoon} active={view==='home'} />}
    </main>
    {view !== 'security' && view !== 'password' && view !== 'profile' && view !== 'withdrawal' && view !== 'wallet-management' && view !== 'agent' && view !== 'invite-friends' && view !== 'invite' && view !== 'personal-report' && view !== 'earn-rules' && view !== 'loss-return-rules' && view !== 'vip' && view !== 'vip-details' && view !== 'records' && view !== 'bet-records' && view !== 'benefits' && view !== 'wallet-ledger' && <BottomNavigation view={view==='game'?'home':view} onNavigate={navigate} />}
    {activeGame&&<GamePage dockRef={gameDockRef} key={activeGame} gameId={activeGame} minimized={view!=='game'} onMinimize={()=>navigate('home')} onBack={()=>{setActiveGame(undefined);navigate('home');}}/>}
    {activeGame&&<MinimizedGameBar targetRef={gameDockRef} visible={view==='home'} gameId={activeGame} onRestore={()=>navigate('game',{gameId:activeGame})} onClose={()=>{forgetGameEntry(activeGame);setActiveGame(undefined);void queryClient.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});}}/>}
  </>;
}
