import { create } from 'zustand';

export type OperationPopup = { id: string; priority: number } & (
  | { kind: 'announcement'; title: string; text: string }
  | { kind: 'deposit' }
  | { kind: 'checkin'; uid: number; ready?: boolean }
);

export const useOperationPopups = create<{
  pending: OperationPopup[];
  active?: OperationPopup;
  enqueue: (items: OperationPopup[]) => void;
  showNext: () => void;
  approveCheckin: (id: string) => void;
  finish: (id: string) => void;
}>((set) => {
  const seen = new Set<string>();
  return {
    pending: [],
    enqueue: items => set(state => {
      const next = items.filter(({ id }) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return next.length ? { pending: [...state.pending, ...next].sort((a, b) => b.priority - a.priority) } : state;
    }),
    showNext: () => set(state => state.active || !state.pending.length ? state : {
      active: state.pending[0], pending: state.pending.slice(1),
    }),
    approveCheckin: id => set(state => state.active?.kind === 'checkin' && state.active.id === id
      ? { active: { ...state.active, ready: true } } : state),
    finish: id => set(state => state.active?.id === id ? { active: undefined } : state),
  };
});
