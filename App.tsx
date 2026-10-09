import { useEffect, useMemo, useState } from "react";
import type { MenuAdapter } from "@shared/adapter";
import { createLiveAdapter, liveRequest, type LiveBootstrap } from "@shared/live-adapter";
import { createFixtureAdapter } from "@shared/fixture-adapter";
import type { FortuneGrade } from "@shared/types";
import { useAppStore } from "./state/useAppStore";
import { HomePage } from "./pages/HomePage";
import { PreparingPage } from "./pages/PreparingPage";
import { StagePage } from "./pages/StagePage";
import { ResultPage } from "./pages/ResultPage";
import { CartPage } from "./pages/CartPage";
import { ConfirmPage } from "./pages/ConfirmPage";

const VALID_GRADES: FortuneGrade[] = ["超级大吉", "大吉", "中吉", "小吉"];

function readUrlOptions(): { seed?: string; forceGrade?: FortuneGrade } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed") ?? undefined;
  const grade = params.get("grade");
  const forceGrade =
    grade && VALID_GRADES.includes(grade as FortuneGrade)
      ? (grade as FortuneGrade)
      : undefined;
  return { seed, forceGrade };
}

export function App() {
  const isLive = document.querySelector('meta[name="mcd-mode"]')?.getAttribute("content") === "live";
  const [bootstrap, setBootstrap] = useState<LiveBootstrap | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fixture = useMemo(() => createFixtureAdapter(), []);
  const adapter = useMemo(() => bootstrap?.connected ? createLiveAdapter(bootstrap) : null, [bootstrap]);
  useEffect(() => {
    if (!isLive) return;
    let active = true;
    liveRequest<LiveBootstrap>("session").then(data => { if (active) setBootstrap(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [isLive]);
  if (!isLive) return <MealApp adapter={fixture} />;
  if (adapter && bootstrap) return <MealApp adapter={adapter} disconnect={async () => {
    await liveRequest("disconnect", bootstrap.csrf, {});
    setBootstrap(await liveRequest<LiveBootstrap>("session"));
  }} />;
  return <div className="app-shell"><main className="read-col">
    <h1>今天麦什么</h1>
    <p>连接自己的麦当劳账号，摇出龙腾大道店的真实餐点。</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {!bootstrap ? <p>正在连接本机服务。连接失败时请刷新页面。</p> :
      <form onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError("");
        try {
          await liveRequest("connect", bootstrap.csrf, { token: token.trim() });
          setToken("");
          setBootstrap(await liveRequest<LiveBootstrap>("session"));
        } catch (e) { setError(e instanceof Error ? e.message : "连接失败，请重试。"); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="mcp-token">麦当劳 MCP Token</label>
        <input id="mcp-token" type="password" autoComplete="off" spellCheck={false}
          value={token} onChange={e => setToken(e.target.value)} required
          style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, margin: "12px 0" }} />
        <p className="price-meta">Token 仅交给这台电脑上的服务，不写入浏览器存储或项目文件。关闭服务后需要重新连接。</p>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "连接中…" : "连接并开始"}</button>
      </form>}
  </main></div>;
}

function MealApp({ adapter, disconnect }: { adapter: MenuAdapter; disconnect?: () => Promise<void> }) {
  const urlOptions = useMemo(readUrlOptions, []);
  const store = useAppStore(adapter, adapter.kind === "live" ? {} : urlOptions);
  const [connectionError, setConnectionError] = useState("");

  const cartCount = store.cart.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="app-shell">
      <header>
        <div className="topbar">
          <span className="brand">今天麦什么</span>
          <div className="topbar-right">
            <span className="mode-badge" data-mode={store.adapterKind === "fixture" ? "demo" : "live"}>
              {store.adapterKind === "live" ? "真实查询" : "模式"}
            </span>
            <button
              type="button"
              className="cart-pill"
              onClick={store.openCart}
              disabled={store.cartBusy}
              aria-label={`待购清单，共 ${cartCount} 件`}
              data-testid="cart-pill"
            >
              🛒 {cartCount}
            </button>
          </div>
        </div>
      </header>

      {/* 屏幕阅读器通知区：价格更新不反复抢焦点 */}
      <div className="visually-hidden" aria-live="polite" data-testid="live-region">
        {store.announcement}
      </div>

      <main>
        {connectionError && <p role="alert">{connectionError}</p>}
        {store.screen === "home" && <HomePage store={store} />}
        {store.screen === "preparing" && <PreparingPage store={store} />}
        {store.screen === "stage" && <StagePage store={store} />}
        {store.screen === "result" && <ResultPage store={store} />}
        {store.screen === "cart" && <CartPage store={store} />}
        {store.screen === "confirm" && <ConfirmPage store={store} />}
      </main>

      <footer>
        独立创意项目 · 非官方产品 · 餐品与价格以官方实时结果为准
        {disconnect && <button type="button" className="btn btn-text"
          disabled={store.cartBusy || store.screen === "preparing"}
          onClick={() => { void disconnect().catch(() => setConnectionError("断开失败，请重试。")); }}>
          断开账号并清空清单
        </button>}
      </footer>
    </div>
  );
}
