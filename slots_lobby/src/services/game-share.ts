export function gameShareUrl(gameId: string): string {
 return new URL('/game/' + encodeURIComponent(gameId), window.location.origin).href;
}
