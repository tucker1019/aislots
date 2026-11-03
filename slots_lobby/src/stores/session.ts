import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isRecord, isSession } from '../features/account/types';
import type { Session } from '../features/account/types';
interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
}
/** 只保存续期所需身份，余额和资料始终交给 Query，不保存密码。 */
export const useSessionStore = create<SessionState>()(persist(set => ({
  session: null,
  setSession: session => set({ session }),
}), {
  name: 'aislots-lobby-session', version: 1,
  partialize: state => ({ session: state.session }),
  merge: (persisted, current) => ({ ...current,
    session: isRecord(persisted) && isSession(persisted.session) ? persisted.session : null,
  }),
}));
