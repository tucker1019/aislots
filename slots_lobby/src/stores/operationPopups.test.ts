import { expect, it } from 'vitest';
import { useOperationPopups } from './operationPopups';

it('shows one popup at a time in priority and arrival order, suppressing duplicates', () => {
  const item = (id: string, priority: number) => ({ id, priority, title: id, text: id });
  const { enqueue, showNext, finish } = useOperationPopups.getState();
  enqueue([item('first', 0), item('second', 0), item('urgent', 1), item('urgent', 1)]);
  for (const id of ['urgent', 'first', 'second']) {
    showNext();
    showNext();
    expect(useOperationPopups.getState().active?.id).toBe(id);
    finish(id);
  }
  enqueue([item('first', 0)]);
  showNext();
  expect(useOperationPopups.getState().active).toBeUndefined();
});
