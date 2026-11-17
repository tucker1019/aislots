const origins = new Map<string, DOMRect>();
export function rememberGameCardOrigin(gameId: string, element: HTMLElement) {
  origins.set(gameId, element.getBoundingClientRect());
}
export function gameCardOrigin(gameId: string) {
  if (!origins.has(gameId)) return null;
  const card = Array.from(document.querySelectorAll<HTMLElement>('.game-tile[data-game-id]'))
    .find(element => element.dataset.gameId === gameId);
  const current = card?.getBoundingClientRect();
  return current?.width && current.height ? current : origins.get(gameId) ?? null;
}
