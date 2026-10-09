import { describe, expect, it } from "vitest";
import {
  addToCart,
  applyContextChange,
  changeQuantity,
  configHash,
  createEmptyCart,
  lineKeyFor,
  provisionalSubtotalInFen,
  removeLine,
} from "@shared/cart";
import { DEMO_CANDIDATES, DEMO_STORE } from "@shared/demo-data";
import type { Context } from "@shared/types";

const context: Context = {
  mode: "demo",
  storeCode: DEMO_STORE.storeCode,
  storeName: DEMO_STORE.storeName,
  storeAddress: DEMO_STORE.storeAddress,
  beType: 1,
  orderType: 1,
  revision: 0,
};

const bigmac = DEMO_CANDIDATES.find((c) => c.id === "cand-bigmac-cola")!;
const corn = DEMO_CANDIDATES.find((c) => c.id === "cand-bigmac-corn-nosugar")!;

describe("cart — 加购与去重", () => {
  it("同一 actionId 重复加购只生效一次", () => {
    const seen = new Set<string>();
    let cart = createEmptyCart(context);
    const r1 = addToCart(cart, bigmac, "action-1", seen);
    cart = r1.cart;
    expect(r1.deduped).toBe(false);
    expect(cart.lines[0].quantity).toBe(1);

    const r2 = addToCart(cart, bigmac, "action-1", seen);
    expect(r2.deduped).toBe(true);
    expect(r2.cart.lines[0].quantity).toBe(1);
  });

  it("新的主动确认（新 actionId）相同配置合并加量", () => {
    const seen = new Set<string>();
    let cart = createEmptyCart(context);
    cart = addToCart(cart, bigmac, "a1", seen).cart;
    cart = addToCart(cart, bigmac, "a2", seen).cart;
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);
  });

  it("不同配置分行", () => {
    const seen = new Set<string>();
    let cart = createEmptyCart(context);
    cart = addToCart(cart, bigmac, "a1", seen).cart;
    cart = addToCart(cart, corn, "a2", seen).cart;
    expect(cart.lines).toHaveLength(2);
  });

  it("加购后状态为 needs_refresh（需重新核价）", () => {
    const seen = new Set<string>();
    const cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    expect(cart.status).toBe("needs_refresh");
  });
});

describe("cart — 配置哈希", () => {
  it("相同配置哈希一致，不同配置哈希不同", () => {
    expect(lineKeyFor(bigmac)).toBe(configHash(bigmac.configuration));
    expect(lineKeyFor(bigmac)).not.toBe(lineKeyFor(corn));
  });

  it("券引用参与合并键", () => {
    const withCoupon = {
      ...bigmac.configuration,
      couponRef: "x",
    };
    expect(configHash(withCoupon)).not.toBe(configHash(bigmac.configuration));
  });
});

describe("cart — 改量与删除", () => {
  it("改数量标记 needs_refresh", () => {
    const seen = new Set<string>();
    let cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    cart = changeQuantity(cart, lineKeyFor(bigmac), 3);
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.status).toBe("needs_refresh");
  });

  it("数量改为 0 时删除该行", () => {
    const seen = new Set<string>();
    let cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    cart = changeQuantity(cart, lineKeyFor(bigmac), 0);
    expect(cart.lines).toHaveLength(0);
  });

  it("负数量抛错", () => {
    const seen = new Set<string>();
    const cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    expect(() => changeQuantity(cart, lineKeyFor(bigmac), -1)).toThrow();
  });

  it("删除指定行", () => {
    const seen = new Set<string>();
    let cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    cart = removeLine(cart, lineKeyFor(bigmac));
    expect(cart.lines).toHaveLength(0);
  });
});

describe("cart — 上下文变化失效报价", () => {
  it("切门店后清空报价并需重新确认", () => {
    const seen = new Set<string>();
    let cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    cart = { ...cart, quote: bigmac.quote, status: "valid" };
    const newContext: Context = { ...context, storeCode: "9999999", revision: 1 };
    cart = applyContextChange(cart, newContext);
    expect(cart.quote).toBeUndefined();
    expect(cart.status).toBe("needs_refresh");
    expect(cart.context.storeCode).toBe("9999999");
  });
});

describe("cart — 小计", () => {
  it("按单价 × 数量累加（分）", () => {
    const seen = new Set<string>();
    let cart = addToCart(createEmptyCart(context), bigmac, "a1", seen).cart;
    cart = changeQuantity(cart, lineKeyFor(bigmac), 2);
    expect(provisionalSubtotalInFen(cart)).toBe(bigmac.quote.payableInFen * 2);
  });
});
