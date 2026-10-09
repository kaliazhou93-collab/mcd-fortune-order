import type { AppStore } from "../state/useAppStore";
import { formatFen } from "@shared/money";
import { provisionalSubtotalInFen } from "@shared/cart";

export function CartPage({ store }: { store: AppStore }) {
  const { cart, context } = store;
  const live = store.adapterKind === "live";
  const needsRefresh = cart.status !== "valid";
  const subtotal = live ? cart.quote?.payableInFen : provisionalSubtotalInFen(cart);
  const empty = cart.lines.length === 0;

  return (
    <div className="read-col">
      <h2>待购清单</h2>
      {store.cartError && <div className="notice" role="alert">{store.cartError}</div>}
      {live && <p className="notice" role="status">这是本应用的购物车；餐点和金额来自真实查询，尚未创建订单。</p>}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <strong>{context.storeName}</strong>
        <div className="price-meta">到店 · {context.storeAddress}</div>
      </div>

      {empty ? (
        <div className="notice" role="status">
          清单还是空的。回首页摇一份，喜欢就「就吃这份」。
          <button className="btn btn-text" onClick={store.goHome}>回首页</button>
        </div>
      ) : (
        <>
          {needsRefresh && (
            <div className="notice" data-tone="info" role="status">
              {live ? "上次报价需要重新确认，请点击重新核价。" : "清单有改动，金额需要重新核价后才能去确认订单（演示模式用示例价占位）。"}
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cart.lines.map((line) => (
              <li key={line.lineKey} className="product-row">
                <div style={{ flex: 1 }}>
                  <strong>{line.product.name}</strong>
                  <div className="price-meta">{line.product.spec}</div>
                  <div className="price-meta">
                    {live ? "抽签时单份报价" : "示例单价"} {formatFen(line.unitPriceInFen)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={store.cartBusy}
                      aria-label={`减少 ${line.product.name} 数量`}
                      onClick={() =>
                        store.changeLineQuantity(line.lineKey, line.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span aria-live="polite" style={{ minWidth: 24, textAlign: "center" }}>
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={store.cartBusy}
                      aria-label={`增加 ${line.product.name} 数量`}
                      onClick={() =>
                        store.changeLineQuantity(line.lineKey, line.quantity + 1)
                      }
                    >
                      ＋
                    </button>
                    <button
                      type="button"
                      className="btn btn-text"
                      disabled={store.cartBusy}
                      onClick={() => store.removeCartLine(line.lineKey)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="price-big">
            {store.cartBusy ? "正在核价…" : needsRefresh ? "上次合计" : "合计"} {subtotal === undefined ? "待核价" : formatFen(subtotal)}
          </div>
          <p className="price-meta">
            {live ? `合计以整份清单重新核价的结果为准，可能与单份报价相加不同。${cart.quote ? `核价时间 ${new Date(cart.quote.calculatedAt).toLocaleTimeString("zh-CN")}。` : ""}` : "示例金额，仅供演示；真实模式结算前会重新核价。"}
          </p>
          {live && cart.quote && <p className="price-meta">
            优惠 {formatFen(cart.quote.discountInFen)} · 打包费 {formatFen(cart.quote.packagingFeeInFen)} · 配送费 {formatFen(cart.quote.deliveryFeeInFen)}。未使用个人优惠券。
          </p>}

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={live ? () => void store.refreshCart() : store.openConfirm}
              disabled={store.cartBusy}
              data-testid="to-confirm"
            >
              {live ? "重新核价" : "去确认订单"}
            </button>
            <button type="button" className="btn btn-text" onClick={store.goHome} disabled={store.cartBusy}>
              再摇一份
            </button>
          </div>
        </>
      )}
    </div>
  );
}
