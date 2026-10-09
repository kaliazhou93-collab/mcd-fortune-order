import type { Cart, CartLine, Candidate, Context, MealConfiguration } from "./types";

// 购物车逻辑（演示版，纯函数，便于测试）。
// 规则对应 ACCEPTANCE C：
// - 同 actionId 重复加购只生效一次；新的主动确认才加量。
// - 相同商品同配置合并数量；不同配置分行。
// - 改数量标记 needs_refresh，需重新核价后才能提交。
// - 切门店/方式/地址失效旧报价。

/** 稳定序列化配置用于合并键。排序保证字段顺序无关。 */
export function configHash(config: MealConfiguration): string {
  const rounds = config.roundList
    .map((r) => {
      const items = r.comboItemList
        .map((i) => {
          const mod = i.modification
            ? `~${i.modification.selectedKey.slice().sort().join(".")}` +
              `|${i.modification.unselectedKey.slice().sort().join(".")}`
            : "";
          return `${i.code}x${i.quantity}${mod}`;
        })
        .sort()
        .join(",");
      return `${r.round}:[${items}]`;
    })
    .sort()
    .join(";");
  // 券适用语义参与合并键。
  return `${config.productCode}#${rounds}#${config.couponRef ?? "nocoupon"}`;
}

export function lineKeyFor(candidate: Candidate): string {
  return configHash(candidate.configuration);
}

export function createEmptyCart(context: Context): Cart {
  return { version: 1, context, lines: [], status: "valid" };
}

export interface AddResult {
  cart: Cart;
  /** 幂等：当 actionId 命中去重记录时为 true，表示本次未新增。 */
  deduped: boolean;
}

/**
 * 加购。seenActions 由调用方维护（服务端短期记录）。
 * 同一 actionId 重复请求返回原 cart、deduped=true。
 */
export function addToCart(
  cart: Cart,
  candidate: Candidate,
  actionId: string,
  seenActions: Set<string>,
): AddResult {
  if (seenActions.has(actionId)) {
    return { cart, deduped: true };
  }
  seenActions.add(actionId);

  const key = lineKeyFor(candidate);
  const existingIndex = cart.lines.findIndex((l) => l.lineKey === key);

  let lines: CartLine[];
  if (existingIndex >= 0) {
    lines = cart.lines.map((l, i) =>
      i === existingIndex ? { ...l, quantity: l.quantity + 1 } : l,
    );
  } else {
    const line: CartLine = {
      lineKey: key,
      product: candidate.product,
      configuration: candidate.configuration,
      quantity: 1,
      attributes: candidate.attributes,
      unitPriceInFen: candidate.quote.payableInFen,
    };
    lines = [...cart.lines, line];
  }

  return {
    cart: { ...cart, version: cart.version + 1, lines, status: "needs_refresh" },
    deduped: false,
  };
}

/** 改数量：标记 needs_refresh，总额在重新核价前不可提交。数量 0 删除该行。 */
export function changeQuantity(cart: Cart, lineKey: string, quantity: number): Cart {
  if (quantity < 0) {
    throw new RangeError("数量不可为负");
  }
  const lines = cart.lines
    .map((l) => (l.lineKey === lineKey ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  return { ...cart, version: cart.version + 1, lines, status: "needs_refresh" };
}

export function removeLine(cart: Cart, lineKey: string): Cart {
  const lines = cart.lines.filter((l) => l.lineKey !== lineKey);
  return { ...cart, version: cart.version + 1, lines, status: "needs_refresh" };
}

/**
 * 门店/方式/地址变化：失效旧报价，整车需重新确认。
 * 不删除行，但状态置为 needs_refresh 并记录新 context。
 */
export function applyContextChange(cart: Cart, context: Context): Cart {
  return { ...cart, context, status: "needs_refresh", quote: undefined };
}

/** 粗略小计（分）：各行 unitPrice × quantity。仅用于「核价中」前的占位展示。 */
export function provisionalSubtotalInFen(cart: Cart): number {
  return cart.lines.reduce((acc, l) => acc + l.unitPriceInFen * l.quantity, 0);
}
