import { create } from 'zustand';

export interface OperationPopup {
  id: string;
  priority: number;
  title: string;
  text: string;
}

export const useOperationPopups = create<{
  pending: OperationPopup[];
  active?: OperationPopup;
  enqueue: (items: OperationPopup[]) => void;
  showNext: () => void;
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
    finish: id => set(state => state.active?.id === id ? { active: undefined } : state),
  };
});
