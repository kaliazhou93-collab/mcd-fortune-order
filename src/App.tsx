import { useMemo } from "react";
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
  const urlOptions = useMemo(readUrlOptions, []);
  // 演示适配器。真实适配器由 M2 的服务端提供，不在浏览器注入 Token。
  const adapter = useMemo(() => createFixtureAdapter(), []);
  const store = useAppStore(adapter, urlOptions);

  const cartCount = store.cart.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="app-shell">
      <header>
        <div className="topbar">
          <span className="brand">今天麦什么</span>
          <div className="topbar-right">
            <span className="mode-badge" data-mode={store.adapterKind === "fixture" ? "demo" : "live"}>
              模式
            </span>
            <button
              type="button"
              className="cart-pill"
              onClick={store.openCart}
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
        {store.screen === "home" && <HomePage store={store} />}
        {store.screen === "preparing" && <PreparingPage store={store} />}
        {store.screen === "stage" && <StagePage store={store} />}
        {store.screen === "result" && <ResultPage store={store} />}
        {store.screen === "cart" && <CartPage store={store} />}
        {store.screen === "confirm" && <ConfirmPage store={store} />}
      </main>

      <footer>
        独立创意项目 · 非官方产品 · 餐品与价格以官方实时结果为准
      </footer>
    </div>
  );
}
