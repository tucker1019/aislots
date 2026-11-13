export interface BetChoice { bet: string; level: number; display: string }
export function totalBet(bet: string, level: number, lines: number): string { return (BigInt(bet)*BigInt(level)*BigInt(lines)).toString(); }
export function buildChoices(bets: string[], lines: number, levels: number): BetChoice[] {
    if (!bets.length || !Number.isSafeInteger(lines) || lines < 1 || !Number.isSafeInteger(levels) || levels < 1 || levels > 100 || bets.some(bet => !/^[1-9][0-9]*$/.test(bet))) throw new Error('Invalid server wager configuration');
    return bets.flatMap(bet => Array.from({length: levels}, (_,i) => ({bet,level:i+1,display:totalBet(bet,i+1,lines)})));
}
