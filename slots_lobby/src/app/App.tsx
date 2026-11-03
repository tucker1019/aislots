import { DepositTracker } from '../features/deposit/DepositTracker';
import { Providers } from './Providers';
import { LobbyPage } from '../pages/LobbyPage';
export function App() { return <Providers><DepositTracker /><LobbyPage /></Providers>; }
