import type { AppStore } from "../state/useAppStore";
import { formatFen } from "@shared/money";
import { provisionalSubtotalInFen } from "@shared/cart";

export function CartPage({ store }: { store: AppStore }) {
  const { cart, context } = store;
  const needsRefresh = cart.status !== "valid";
  const subtotal = provisionalSubtotalInFen(cart);
  const empty = cart.lines.length === 0;

  return (
    <div className="read-col">
      <h2>待购清单</h2>
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <strong>{context.storeName}</strong>
        <div className="price-meta">到店 · {context.storeAddress}</div>
      </div>

      {empty ? (
        <div className="notice" role="status">
          清单还是空的。回首页摇一份，喜欢就「就吃这份」。
        </div>
      ) : (
        <>
          {needsRefresh && (
            <div className="notice" data-tone="info" role="status">
              清单有改动，金额需要重新核价后才能去确认订单（演示模式用示例价占位）。
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cart.lines.map((line) => (
              <li key={line.lineKey} className="product-row">
                <div style={{ flex: 1 }}>
                  <strong>{line.product.name}</strong>
                  <div className="price-meta">{line.product.spec}</div>
                  <div className="price-meta">
                    示例单价 {formatFen(line.unitPriceInFen)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
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
            {needsRefresh ? "核价中…" : "合计"} {formatFen(subtotal)}
          </div>
          <p className="price-meta">
            示例金额，仅供演示；真实模式结算前会重新核价。
          </p>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={store.openConfirm}
              data-testid="to-confirm"
            >
              去确认订单
            </button>
            <button type="button" className="btn btn-text" onClick={store.goHome}>
              再摇一份
            </button>
          </div>
        </>
      )}
    </div>
  );
}
