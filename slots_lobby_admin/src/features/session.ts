import { create } from 'zustand';
import type { Session } from '../services/admin';
type Screen = 'overview' | 'members' | 'orders' | 'configs' | 'audit' | 'gamePreview';
interface State { session: Session | null; screen: Screen; setSession: (session: Session | null) => void; navigate: (screen: Screen) => void }
export const useConsole = create<State>(set => ({ session: null, screen: 'overview', setSession: session => set({ session }), navigate: screen => set({ screen }) }));
