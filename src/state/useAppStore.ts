import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuAdapter } from "@shared/adapter";
import type {
  Cart,
  Candidate,
  Context,
  Exclusion,
  Fortune,
  FortuneGrade,
  Mood,
  Preference,
} from "@shared/types";
import { createRng, seedFromString } from "@shared/rng";
import { pickFortune } from "@shared/fortune";
import { preparePool, sampleCandidate } from "@shared/recommend";
import {
  addToCart,
  changeQuantity,
  createEmptyCart,
  removeLine,
} from "@shared/cart";
import { DEMO_STORE } from "@shared/demo-data";

export type Screen = "home" | "preparing" | "stage" | "result" | "cart" | "confirm";

export interface PrepareError {
  kind: "no-candidates" | "unknown-blocked" | "pricing";
  message: string;
}

export interface AppStore {
  screen: Screen;
  context: Context;
  preference: Preference;
  cart: Cart;
  current: { candidate: Candidate; fortune: Fortune } | null;
  prepareError: PrepareError | null;
  announcement: string;
  adapterKind: MenuAdapter["kind"];
  cartBusy: boolean;
  cartError: string | null;
  refreshCart(): Promise<void>;

  setMood(mood: Mood): void;
  toggleExclusion(ex: Exclusion): void;
  canDraw: boolean;

  draw(): Promise<void>;
  reroll(): Promise<void>;
  /** 舞台动画结束后推进到结果页。 */
  toResult(): void;
  goHome(): void;

  openCart(): void;
  confirmAdd(): void;
  changeLineQuantity(lineKey: string, qty: number): void;
  removeCartLine(lineKey: string): void;

  openConfirm(): void;
  backToResult(): void;
}

export interface StoreOptions {
  /** 调试种子（?seed=），正式用户不能借此换优惠。 */
  seed?: string;
  /** 强制等级，仅用于验收测试。 */
  forceGrade?: FortuneGrade;
}

function initialContext(): Context {
  return {
    mode: "demo",
    storeCode: DEMO_STORE.storeCode,
    storeName: DEMO_STORE.storeName,
    storeAddress: DEMO_STORE.storeAddress,
    beType: 1,
    orderType: 1,
    revision: 0,
  };
}

export function useAppStore(adapter: MenuAdapter, options: StoreOptions = {}): AppStore {
  const [context] = useState<Context>(() => adapter.initialContext ?? initialContext());
  const [preference, setPreference] = useState<Preference>({
    mood: "treat",
    exclusions: [],
    revision: 0,
  });
  const [screen, setScreen] = useState<Screen>("home");
  const [cart, setCart] = useState<Cart>(() => adapter.initialCart ?? createEmptyCart(context));
  const [cartBusy, setCartBusy] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const operationBusy = useRef(false);
  const pendingAdd = useRef<{ candidateId: string; actionId: string } | null>(null);
  const [current, setCurrent] = useState<AppStore["current"]>(null);
  const [prepareError, setPrepareError] = useState<PrepareError | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [moodChosen, setMoodChosen] = useState(false);

  // 过期响应保护：每次 draw 自增，异步回来后比对，旧的丢弃。
  const drawToken = useRef(0);
  const fortuneHistory = useRef<string[]>([]);
  const drawCount = useRef(0);
  const seenActions = useRef<Set<string>>(new Set());
  // 读取最新结果，供事件处理函数在不进入渲染周期的情况下使用。
  const currentRef = useRef<AppStore["current"]>(null);
  const lastAddNonce = useRef(0);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const baseSeed = useMemo(
    () =>
      options.seed ? seedFromString(options.seed) : Math.floor(Math.random() * 2 ** 31),
    [options.seed],
  );

  const setMood = useCallback((mood: Mood) => {
    setMoodChosen(true);
    setPreference((p) => ({ ...p, mood, revision: p.revision + 1 }));
  }, []);

  const toggleExclusion = useCallback((ex: Exclusion) => {
    setPreference((p) => {
      let exclusions: Exclusion[];
      if (ex === "anything") {
        exclusions = p.exclusions.includes("anything") ? [] : ["anything"];
      } else {
        const without = p.exclusions.filter((e) => e !== "anything");
        exclusions = without.includes(ex)
          ? without.filter((e) => e !== ex)
          : [...without, ex];
      }
      return { ...p, exclusions, revision: p.revision + 1 };
    });
  }, []);

  const canDraw = moodChosen;

  const runDraw = useCallback(
    async (avoidProductCode?: string) => {
      const token = (drawToken.current += 1);
      setPrepareError(null);
      setScreen("preparing");
      setAnnouncement("看看这家店今天有什么");

      let candidates: Candidate[];
      try {
        candidates = await adapter.getCandidates(context, preference);
      } catch (error) {
        if (token !== drawToken.current) return;
        setPrepareError({ kind: "pricing", message: adapter.kind === "live" && error instanceof Error
          ? error.message : "价格还没确认好，请重试或返回。" });
        setScreen("home");
        return;
      }
      // 旧请求晚返回：丢弃，不覆盖新条件。
      if (token !== drawToken.current) return;

      const { pool, droppedForUnknown } = preparePool(candidates, preference);

      // 商品随机与签文随机独立：不同种子派生实例。
      drawCount.current += 1;
      const itemRng = createRng(baseSeed + drawCount.current * 7919);
      const fortuneRng = createRng(baseSeed + drawCount.current * 104729 + 1);

      const candidate = sampleCandidate(pool, itemRng, avoidProductCode);
      if (!candidate) {
        if (droppedForUnknown.length > 0) {
          setPrepareError({
            kind: "unknown-blocked",
            message: "有些餐品的资料不够，先被保守排除了。换个条件看看？",
          });
        } else {
          setPrepareError({
            kind: "no-candidates",
            message: "今天的条件有点挑，换个条件或查看已选条件。",
          });
        }
        setScreen("home");
        return;
      }

      let fortunes: Fortune[];
      try { fortunes = await adapter.getFortunes(); }
      catch {
        if (token !== drawToken.current) return;
        setPrepareError({ kind: "pricing", message: "签文暂时没加载好，请重试。" });
        setScreen("home");
        return;
      }
      if (token !== drawToken.current) return;
      const picked = pickFortune(fortunes, fortuneHistory.current, fortuneRng, {
        forceGrade: options.forceGrade,
      });
      fortuneHistory.current = picked.history;

      setCurrent({ candidate, fortune: picked.fortune });
      setCartError(null);
      setScreen("stage");
      setAnnouncement("");
    },
    [adapter, baseSeed, context, options.forceGrade, preference],
  );

  const draw = useCallback(() => runDraw(), [runDraw]);
  const reroll = useCallback(
    () => runDraw(current?.candidate.product.code),
    [current, runDraw],
  );

  const toResult = useCallback(() => {
    setScreen("result");
    setAnnouncement("已经为你摇出一份搭配");
  }, []);

  const goHome = useCallback(() => {
    drawToken.current += 1;
    setScreen("home");
    setCurrent(null);
    setPrepareError(null);
  }, []);

  const liveOperation = useCallback(async (work: () => Promise<Cart>, added = false) => {
    if (operationBusy.current) return;
    operationBusy.current = true;
    setCartBusy(true);
    setCartError(null);
    try {
      setCart(await work());
      if (added) {
        pendingAdd.current = null;
        setScreen("cart");
        setAnnouncement("已按门店实价加入本应用购物车，尚未下单");
      }
    } catch (error) {
      setCartError(error instanceof Error ? error.message : "核价失败，请重试。");
      setCart(c => ({ ...c, status: "needs_refresh" }));
      try { if (adapter.liveCart) setCart(await adapter.liveCart.read()); } catch { /* Keep previous cart. */ }
    } finally {
      operationBusy.current = false;
      setCartBusy(false);
    }
  }, [adapter]);

  const openCart = useCallback(() => {
    setScreen("cart");
    if (adapter.liveCart) void liveOperation(() => adapter.liveCart!.read());
  }, [adapter, liveOperation]);

  const confirmAdd = useCallback(() => {
    const cur = currentRef.current;
    if (adapter.liveCart && cur) {
      if (!pendingAdd.current || pendingAdd.current.candidateId !== cur.candidate.id) {
        pendingAdd.current = { candidateId: cur.candidate.id, actionId: crypto.randomUUID() };
      }
      const action = pendingAdd.current;
      void liveOperation(() => adapter.liveCart!.add(action.candidateId, action.actionId, cart.version), true);
      return;
    }
    if (cur) {
      const actionId = `add-${cur.candidate.id}-${lastAddNonce.current}`;
      lastAddNonce.current += 1;
      // 在更新器外计算，保证 seenActions 变更与去重判断只发生一次。
      setCart((c) => addToCart(c, cur.candidate, actionId, seenActions.current).cart);
    }
    setAnnouncement("已加入待购清单");
    setScreen("cart");
  }, [adapter, cart.version, liveOperation]);

  const changeLineQuantity = useCallback((lineKey: string, qty: number) => {
    if (adapter.liveCart) {
      void liveOperation(() => adapter.liveCart!.change(lineKey, qty, cart.version));
      return;
    }
    setCart((c) => changeQuantity(c, lineKey, qty));
  }, [adapter, cart.version, liveOperation]);

  const removeCartLine = useCallback((lineKey: string) => {
    if (adapter.liveCart) {
      void liveOperation(() => adapter.liveCart!.change(lineKey, 0, cart.version));
      return;
    }
    setCart((c) => removeLine(c, lineKey));
  }, [adapter, cart.version, liveOperation]);

  const refreshCart = useCallback(async () => {
    if (adapter.liveCart) await liveOperation(() => adapter.liveCart!.refresh(cart.version));
  }, [adapter, cart.version, liveOperation]);
  const openConfirm = useCallback(() => setScreen(adapter.kind === "live" ? "cart" : "confirm"), [adapter.kind]);
  const backToResult = useCallback(
    () => setScreen(current ? "result" : "home"),
    [current],
  );

  return {
    screen,
    context,
    preference,
    cart,
    current,
    prepareError,
    announcement,
    adapterKind: adapter.kind,
    cartBusy,
    cartError,
    refreshCart,
    setMood,
    toggleExclusion,
    canDraw,
    draw,
    reroll,
    toResult,
    goHome,
    openCart,
    confirmAdd,
    changeLineQuantity,
    removeCartLine,
    openConfirm,
    backToResult,
  };
}
