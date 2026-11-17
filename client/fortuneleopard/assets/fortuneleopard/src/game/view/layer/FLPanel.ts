import { _decorator, Component, UIOpacity, WebView } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FLPanel')
export class FLPanel extends Component {

    @property(WebView)
    webView: WebView = null;

    private webViewOpacity: UIOpacity = null;
    private loadToken = 0;
    private revealTimeoutId = 0;
    private coverHideTimeoutId = 0;
    private iframeLoadHandler: (() => void) | null = null;
    private iframeErrorHandler: (() => void) | null = null;
    private loadingCoverEl: HTMLDivElement | null = null;
    private hasPendingOpen = false;
    private currentSceneName = "";
    private readonly revealFallbackMs = 8000;
    private readonly revealFadeMs = 0.12;
    private readonly revealReadyDelayMs = 120;
    private readonly loadingBg = "#24242D";
    private readonly loadingCoverClassName = "mw-webview-loading-cover";
    private readonly webViewDebug = true;

    onLoad() {
        this.webViewOpacity = this.webView.node.getComponent(UIOpacity) || this.webView.node.addComponent(UIOpacity);
        this.hideWebView("onLoad");
    }

    onEnable() {
        if (WebView.EventType?.LOADED) {
            this.webView.node.on(WebView.EventType.LOADED, this.onWebViewLoaded, this);
        }
        if (WebView.EventType?.ERROR) {
            this.webView.node.on(WebView.EventType.ERROR, this.onWebViewError, this);
        }
        if (WebView.EventType?.LOADING) {
            this.webView.node.on(WebView.EventType.LOADING, this.onWebViewLoading, this);
        }
    }

    onDisable() {
        if (WebView.EventType?.LOADED) {
            this.webView.node.off(WebView.EventType.LOADED, this.onWebViewLoaded, this);
        }
        if (WebView.EventType?.ERROR) {
            this.webView.node.off(WebView.EventType.ERROR, this.onWebViewError, this);
        }
        if (WebView.EventType?.LOADING) {
            this.webView.node.off(WebView.EventType.LOADING, this.onWebViewLoading, this);
        }
        this.clearIframeWatchers();
        this.clearRevealTimeout();
        this.clearCoverHideTimeout();
        this.hasPendingOpen = false;
    }

    openUrl(sceneName: string, url: string) {
        this.loadToken += 1;
        const token = this.loadToken;
        this.currentSceneName = sceneName;
        this.hasPendingOpen = true;
        this.webView.node.active = true;
        this.hideWebView(`openUrl:${sceneName}`);
        this.logWebView(`${sceneName} openUrl`, { url, token });
        this.prepareLoad(sceneName, url, token, 0);
    }

    private prepareLoad(sceneName: string, url: string, token: number, retryCount: number) {
        if (token !== this.loadToken) {
            return;
        }

        const nativeWebView = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
        if (!nativeWebView) {
            if (retryCount >= 10) {
                this.logWebView(`${sceneName} nativeWebView missing after retries`, { retryCount });
                this.revealWebView("native-missing-fallback", token);
                return;
            }

            this.logWebView(`${sceneName} wait nativeWebView`, { retryCount });
            window.setTimeout(() => {
                this.prepareLoad(sceneName, url, token, retryCount + 1);
            }, 50);
            return;
        }

        this.showCoveredWebView(sceneName, nativeWebView, `before-assign-url-${retryCount}`);
        this.applyWebViewBackground(sceneName, nativeWebView, `before-assign-url-${retryCount}`);
        this.attachIframeWatchers(sceneName, nativeWebView, token);
        this.webView.url = url;

        window.setTimeout(() => {
            if (token !== this.loadToken) {
                return;
            }

            const iframe = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
            if (iframe) {
                this.showCoveredWebView(sceneName, iframe, "after-assign-url");
                this.applyWebViewBackground(sceneName, iframe, "after-assign-url");
            }
        }, 0);

        this.clearRevealTimeout();
        this.revealTimeoutId = window.setTimeout(() => {
            this.logWebView(`${sceneName} reveal fallback timeout`, { token });
            this.revealWebView("timeout-fallback", token);
        }, this.revealFallbackMs);
    }

    private attachIframeWatchers(sceneName: string, nativeWebView: HTMLIFrameElement, token: number) {
        this.clearIframeWatchers();

        this.iframeLoadHandler = () => {
            this.logWebView(`${sceneName} iframe load`, {
                token,
                src: nativeWebView.src,
            });
            this.revealWebView("iframe-load", token);
        };

        this.iframeErrorHandler = () => {
            this.logWebView(`${sceneName} iframe error`, {
                token,
                src: nativeWebView.src,
            });
            this.revealWebView("iframe-error", token);
        };

        nativeWebView.addEventListener("load", this.iframeLoadHandler, { once: true });
        nativeWebView.addEventListener("error", this.iframeErrorHandler, { once: true });
    }

    private clearIframeWatchers() {
        const nativeWebView = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
        if (nativeWebView && this.iframeLoadHandler) {
            nativeWebView.removeEventListener("load", this.iframeLoadHandler);
        }
        if (nativeWebView && this.iframeErrorHandler) {
            nativeWebView.removeEventListener("error", this.iframeErrorHandler);
        }
        this.iframeLoadHandler = null;
        this.iframeErrorHandler = null;
    }

    private clearRevealTimeout() {
        if (this.revealTimeoutId) {
            window.clearTimeout(this.revealTimeoutId);
            this.revealTimeoutId = 0;
        }
    }

    private clearCoverHideTimeout() {
        if (this.coverHideTimeoutId) {
            window.clearTimeout(this.coverHideTimeoutId);
            this.coverHideTimeoutId = 0;
        }
    }

    private ensureLoadingCover(sceneName: string, nativeWebView: HTMLIFrameElement) {
        const wrapper = nativeWebView.parentElement as HTMLDivElement | null;
        if (!wrapper) {
            this.logWebView(`${sceneName} cover skipped`, { reason: "missing-wrapper" });
            return null;
        }

        let cover = wrapper.querySelector(`.${this.loadingCoverClassName}`) as HTMLDivElement | null;
        if (!cover) {
            cover = document.createElement("div");
            cover.className = this.loadingCoverClassName;
            cover.style.position = "absolute";
            cover.style.left = "0";
            cover.style.top = "0";
            cover.style.width = "100%";
            cover.style.height = "100%";
            cover.style.zIndex = "2";
            cover.style.pointerEvents = "auto";
            cover.style.transition = `opacity ${this.revealFadeMs}s ease`;
            wrapper.appendChild(cover);
            this.logWebView(`${sceneName} cover created`);
        }

        nativeWebView.style.position = "relative";
        nativeWebView.style.zIndex = "1";
        cover.style.backgroundColor = this.loadingBg;
        cover.style.background = this.loadingBg;
        this.loadingCoverEl = cover;
        return cover;
    }

    private showLoadingCover(sceneName: string, nativeWebView: HTMLIFrameElement, stage: string) {
        const cover = this.ensureLoadingCover(sceneName, nativeWebView);
        if (!cover) {
            return;
        }

        this.clearCoverHideTimeout();
        cover.style.visibility = "visible";
        cover.style.opacity = "1";
        cover.style.pointerEvents = "auto";
        this.logWebView(`${sceneName} cover show`, {
            stage,
            coverBg: cover.style.backgroundColor,
            coverOpacity: cover.style.opacity,
        });
    }

    private hideLoadingCover(sceneName: string, stage: string) {
        if (!this.loadingCoverEl) {
            return;
        }

        this.clearCoverHideTimeout();
        this.loadingCoverEl.style.opacity = "0";
        this.loadingCoverEl.style.pointerEvents = "none";
        this.coverHideTimeoutId = window.setTimeout(() => {
            if (!this.loadingCoverEl) {
                return;
            }
            this.loadingCoverEl.style.visibility = "hidden";
            this.logWebView(`${sceneName} cover hide`, { stage });
        }, Math.max(80, Math.round(this.revealFadeMs * 1000) + 30));
    }

    private showCoveredWebView(sceneName: string, nativeWebView: HTMLIFrameElement, stage: string) {
        const wrapper = nativeWebView.parentElement as HTMLDivElement | null;
        if (!wrapper) {
            this.logWebView(`${sceneName} show covered skipped`, { stage });
            return;
        }

        wrapper.style.visibility = "visible";
        wrapper.style.opacity = "1";
        nativeWebView.style.visibility = "visible";
        nativeWebView.style.opacity = "1";
        this.webViewOpacity.opacity = 255;
        this.showLoadingCover(sceneName, nativeWebView, stage);
    }

    private hideWebView(stage: string) {
        const nativeWebView = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
        const wrapper = nativeWebView?.parentElement as HTMLDivElement | null;

        this.clearCoverHideTimeout();
        this.webViewOpacity.opacity = 255;

        if (nativeWebView) {
            this.showLoadingCover(this.currentSceneName || "WebView", nativeWebView, stage);
        }
        if (wrapper) {
            wrapper.style.visibility = "hidden";
            wrapper.style.opacity = "1";
        }
        if (nativeWebView) {
            nativeWebView.style.visibility = "visible";
            nativeWebView.style.opacity = "1";
        }

        this.logWebView(`${this.currentSceneName || "WebView"} hide`, { stage });
    }

    private revealWebView(source: string, token: number) {
        if (token !== this.loadToken) {
            this.logWebView(`${this.currentSceneName} skip reveal for stale token`, { source, token });
            return;
        }

        this.clearRevealTimeout();
        const nativeWebView = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
        if (nativeWebView) {
            this.showCoveredWebView(this.currentSceneName, nativeWebView, `pre-reveal:${source}`);
            this.applyWebViewBackground(this.currentSceneName, nativeWebView, `reveal:${source}`);
        }

        this.clearCoverHideTimeout();
        this.coverHideTimeoutId = window.setTimeout(() => {
            if (token !== this.loadToken) {
                return;
            }

            this.hideLoadingCover(this.currentSceneName, source);
            this.hasPendingOpen = false;
            this.logWebView(`${this.currentSceneName} reveal`, {
                source,
                token,
                src: nativeWebView?.src,
            });
        }, this.revealReadyDelayMs);
    }

    private applyWebViewBackground(sceneName: string, nativeWebView: HTMLIFrameElement, stage: string) {
        const wrapper = nativeWebView.parentElement as HTMLDivElement | null;
        if (!wrapper) {
            this.logWebView(`${sceneName} background skipped`, { stage });
            return;
        }

        wrapper.style.backgroundColor = this.loadingBg;
        wrapper.style.background = this.loadingBg;
        wrapper.style.overflow = "hidden";
        nativeWebView.style.backgroundColor = this.loadingBg;
        nativeWebView.style.background = this.loadingBg;

        this.logWebView(`${sceneName} background applied`, {
            stage,
            wrapperBg: wrapper.style.backgroundColor,
            iframeBg: nativeWebView.style.backgroundColor,
            iframeVisibility: nativeWebView.style.visibility,
            iframeOpacity: nativeWebView.style.opacity,
            coverVisibility: this.loadingCoverEl?.style.visibility,
            coverOpacity: this.loadingCoverEl?.style.opacity,
        });
    }

    private onWebViewLoading() {
        this.logWebView(`${this.currentSceneName} cocos loading`, {
            src: this.webView?.nativeWebView?.src,
        });

        if (!this.hasPendingOpen) {
            return;
        }

        const nativeWebView = this.webView?.nativeWebView as HTMLIFrameElement | undefined;
        if (nativeWebView) {
            this.showLoadingCover(this.currentSceneName, nativeWebView, "cocos-loading");
            this.applyWebViewBackground(this.currentSceneName, nativeWebView, "cocos-loading");
        }
    }

    private onWebViewLoaded() {
        this.logWebView(`${this.currentSceneName} cocos loaded`, {
            token: this.loadToken,
            src: this.webView?.nativeWebView?.src,
        });

        if (!this.hasPendingOpen) {
            this.logWebView(`${this.currentSceneName || "WebView"} ignore cocos loaded without pending open`);
        }
    }

    private onWebViewError() {
        this.logWebView(`${this.currentSceneName} cocos error`, {
            token: this.loadToken,
            src: this.webView?.nativeWebView?.src,
        });

        if (!this.hasPendingOpen) {
            return;
        }
        this.revealWebView("cocos-error", this.loadToken);
    }

    private logWebView(message: string, extra?: unknown) {
        if (!this.webViewDebug) {
            return;
        }

        const now = Math.round(performance.now());
        if (extra !== undefined) {
            console.log(`[MWPanel ${now}ms] ${message}`, extra);
        } else {
            console.log(`[MWPanel ${now}ms] ${message}`);
        }
    }
}
