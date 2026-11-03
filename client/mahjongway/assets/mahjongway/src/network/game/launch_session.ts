/** 独立于大厅sid的游戏会话，限定在当前标签页，刷新可恢复。 */
export class LaunchSession {
    private key: string;
    constructor(base: string, game: string) { this.key = 'aislots-live:' + base + ':' + game; }
    private storage(): Storage { return sessionStorage; }
    read(): { token?: string; ticket?: string; exchangeId?: string; live?: boolean } {
        if (typeof sessionStorage === 'undefined') return {};
        const text = this.storage().getItem(this.key);
        if (!text) return {};
        try {
            const value = JSON.parse(text);
            return { live: true, token: typeof value?.token === 'string' ? value.token : undefined,
                ticket: typeof value?.ticket === 'string' ? value.ticket : undefined,
                exchangeId: typeof value?.exchangeId === 'string' ? value.exchangeId : undefined };
        }
        catch { return { live: true }; }
    }
    request(): { launchTicket: string; exchangeId: string } | null {
        const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
        const ticket = params.get('launchTicket');
        if (!params.has('launchTicket')) return null;
        if (!ticket || ticket.length !== 52) { this.expire(); throw new Error('游戏进入凭据无效，请从大厅重新进入'); }
        const previous = this.read();
        if (previous.ticket === ticket && previous.token) return null;
        const exchangeId = previous.ticket === ticket && typeof previous.exchangeId === 'string'
            ? previous.exchangeId : Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
        this.storage().setItem(this.key, JSON.stringify({ live: true, ticket, exchangeId }));
        return { launchTicket: ticket, exchangeId };
    }
    save(token: string) {
        this.storage().setItem(this.key, JSON.stringify({ live: true, token, ticket: this.read().ticket }));
        this.clearTicketURL();
    }
    clearTicketURL() {
        const url = new URL(location.href); url.searchParams.delete('launchTicket');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    expire() { this.storage().setItem(this.key, JSON.stringify({ live: true })); }
}
