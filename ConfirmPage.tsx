import { useState } from "react";
import type { AppStore } from "../state/useAppStore";
import { formatFen } from "@shared/money";
import { provisionalSubtotalInFen } from "@shared/cart";

/**
 * 订单确认页（演示）。
 * 重要：这是模拟确认，绝不调用真实 MCP 或 create-order。
 * 展示完整门店/取餐信息与总额，用普通文字说明会创建订单（真实模式下）。
 */
export function ConfirmPage({ store }: { store: AppStore }) {
  const { cart, context } = store;
  const [placed, setPlaced] = useState(false);
  const total = provisionalSubtotalInFen(cart);

  if (placed) {
    return (
      <div className="read-col">
        <div className="notice" data-tone="info" role="status">
          <strong>演示：模拟订单已创建，等待支付</strong>
          <p className="price-meta" style={{ marginTop: 8 }}>
            这是演示模式的模拟结果，未调用任何真实下单或支付接口。真实模式下，
            支付入口由官方返回，返回应用后会主动查询状态，不推断已付。
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={store.openCart}>
            返回清单
          </button>
          <button type="button" className="btn btn-text" onClick={store.goHome}>
            再摇一份
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="read-col">
      <h2>确认订单</h2>
      <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <strong>{context.storeName}</strong>
        <div className="price-meta">取餐方式：堂食 / 外带柜（示例）</div>
        <div className="price-meta">{context.storeAddress}</div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {cart.lines.map((line) => (
          <li key={line.lineKey} className="product-row">
            <div style={{ flex: 1 }}>
              <strong>{line.product.name}</strong>
              <div className="price-meta">
                {line.product.spec} · ×{line.quantity}
              </div>
            </div>
            <div>{formatFen(line.unitPriceInFen * line.quantity)}</div>
          </li>
        ))}
      </ul>

      <p className="price-meta" style={{ marginTop: 16 }}>
        点击下方按钮将（在真实模式下）创建订单；支付仍需前往官方入口。演示模式只做模拟，不下单、不收款。
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setPlaced(true)}
          disabled={cart.lines.length === 0}
          data-testid="place-order"
        >
          确认下单（演示） · {formatFen(total)}
        </button>
        <button type="button" className="btn btn-text" onClick={store.openCart}>
          返回清单
        </button>
      </div>
    </div>
  );
}
