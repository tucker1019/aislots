import { OperationPopupHost } from '../features/operations/OperationPopupHost';
import {ClaimIndicatorsSync} from '../features/rewards/ClaimIndicatorsSync';
import {useEffect} from 'react';
import {pendingInviteCode} from '../services/invite-binding';
import {AuthModal} from '../features/auth/AuthModal';
import { DepositTracker } from '../features/deposit/DepositTracker';
import { Providers } from './Providers';
import { LobbyPage } from '../pages/LobbyPage';
export function App() { useEffect(()=>{pendingInviteCode(false);},[]); return <Providers><ClaimIndicatorsSync/><DepositTracker /><LobbyPage /><OperationPopupHost /><AuthModal /></Providers>; }
