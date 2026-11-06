import {installLayoutDiagnostics} from './app/layoutDiagnostics';
import { installDesignViewport } from './app/designViewport';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/home.css';
import './styles/account.css';
import './styles/deposit.css';
import './styles/cash-records.css';
import './styles/bet-records.css';
import './styles/benefits.css';
import './styles/vip.css';
import './styles/checkin.css';
import './styles/wallet-ledger.css';
import './styles/records.css';
import './styles/personal-report.css';
import './styles/earn.css';
import { App } from './app/App';
const disposeViewport=installDesignViewport();
installLayoutDiagnostics();
if(import.meta.hot)import.meta.hot.dispose(disposeViewport);
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

import './styles/game-detail.css';

import './styles/invite.css';

import './styles/agent.css';

import './styles/offers.css';

import './styles/design-viewport.css';

import './styles/theme.css';
