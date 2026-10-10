import { useEffect, useRef } from "react";
import type { AppStore } from "../state/useAppStore";
import type { FortuneScene } from "@shared/types";
import { formatFen } from "@shared/money";
import { ProductThumb } from "../components/ProductThumb";

const SCENE_IMG: Record<FortuneScene, { src: string; alt: string; ratio: string }> = {
  celebration: {
    src: `${import.meta.env.BASE_URL}art/shop-celebration.png`,
    alt: "金色庆祝场景：一起庆祝",
    ratio: "ratio-square",
  },
  comfort: {
    src: `${import.meta.env.BASE_URL}art/shop-comfort.png`,
    alt: "温柔陪伴场景：慢慢来也很好",
    ratio: "ratio-square",
  },
  welcome: {
    src: `${import.meta.env.BASE_URL}art/shop-welcome.png`,
    alt: "普通店铺场景",
    ratio: "ratio-welcome",
  },
};

function formatCheckedAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function ResultPage({ store }: { store: AppStore }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = store.current;

  // 出签完成把焦点移到结果标题。
  useEffect(() => {
    headingRef.current?.focus();
  }, [current]);

  if (!current) {
    return (
      <div className="card">
        <p>还没有结果，先回首页摇一份吧。</p>
        <button type="button" className="btn btn-secondary" onClick={store.goHome}>
          返回条件
        </button>
      </div>
    );
  }

  const { candidate, fortune } = current;
  const scene = SCENE_IMG[fortune.scene];
  const quote = candidate.quote;
  const hasDiscount = quote.discountInFen > 0;

  return (
    <div className="two-col">
      <section>
        <img
          className={`scene-img ${scene.ratio}`}
          src={scene.src}
          alt={scene.alt}
          width={1024}
          height={fortune.scene === "welcome" ? 709 : 1024}
        />
      </section>

      <section className="read-col">
        <span className="grade-tag">{fortune.grade}</span>
        <h2 ref={headingRef} tabIndex={-1}>
          {fortune.title}
        </h2>
        <p className="fortune-message">{fortune.message}</p>

        <div role="group" aria-label="推荐餐品">
          <div className="product-row">
            <ProductThumb src={candidate.product.imageUrl} alt={candidate.product.name} />
            <div>
              <strong>{candidate.product.name}</strong>
              <div className="price-meta">
                {candidate.product.spec} · 数量 {candidate.configuration.quantity}
              </div>
            </div>
          </div>
        </div>

        {candidate.reasons.length > 0 && (
          <ul className="reasons" aria-label="与偏好匹配的事实理由">
            {candidate.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        <div className="price-big" aria-live="polite">
          {store.adapterKind === "live" ? "当前报价" : "本次应付"} {formatFen(quote.payableInFen)}
        </div>
        {hasDiscount && (
          <div className="price-meta">
            含优惠 {formatFen(quote.discountInFen)}
            {quote.couponSummary ? ` · ${quote.couponSummary}` : ""}
          </div>
        )}
        <div className="price-meta">
          {store.adapterKind === "live"
            ? `门店实价 · ${formatCheckedAt(quote.calculatedAt)} 核价，加入清单时再次确认价格`
            : `示例报价 · ${formatCheckedAt(quote.calculatedAt)} 核价（历史示例，非今日价格承诺）`}
        </div>
        {store.cartError && <p className="notice" role="alert">{store.cartError}</p>}

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={store.confirmAdd}
            data-testid="eat-this"
            disabled={store.cartBusy}
          >
            {store.cartBusy ? "正在核价并加入…" : "就吃这份"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void store.reroll()}
            data-testid="reroll"
            disabled={store.cartBusy}
          >
            换个口味
          </button>
          <button type="button" className="btn btn-text" onClick={store.goHome} disabled={store.cartBusy}>
            修改条件
          </button>
        </div>
      </section>
    </div>
  );
}
