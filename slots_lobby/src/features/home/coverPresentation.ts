// Match the original shipped artwork as well as the ID: an operator's custom
// cover remains authoritative, while titles always come from the live catalog.
const originals: Readonly<Record<string, string>> = {
  AG1: '/assets/lobby/mahjong-icon.png',
  AG2: '/assets/lobby/games/1024.png',
  AG3: '/assets/lobby/games/1068.png',
  AG4: '/assets/lobby/games/1017.png',
  AG5: '/assets/lobby/games/1018.png',
  AG6: '/assets/lobby/games/1019.png',
  AG7: '/assets/lobby/games/1023.png',
  AG8: '/assets/lobby/games/1048.png',
  AG9: '/assets/lobby/games/1021.png',
  AG10: '/assets/lobby/games/1022.png',
};

export function coverPresentation(gameId: string | undefined, cover: string) {
  const redesigned = gameId !== undefined && originals[gameId] === cover;
  return {
    src: redesigned ? `/assets/lobby/covers/indonesia-v2/${gameId}.webp` : cover,
    redesigned,
  };
}
