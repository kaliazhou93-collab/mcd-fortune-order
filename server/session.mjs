import { createHash, randomUUID } from "node:crypto";
import { connectReadOnly, quoteSummary } from "../scripts/mcp-core.mjs";
import { LiveError, validatePreference, parseNutrition, configureMeal, menuCodes } from "./catalog.mjs";
import { LIVE_STORE } from "./store.mjs";

export const STORE_CODE = LIVE_STORE.storeCode;
export const initialLiveContext = {
  mode: "live", storeCode: STORE_CODE, storeName: LIVE_STORE.storeName,
  storeAddress: LIVE_STORE.storeAddress, beType: 1, orderType: 1, revision: 0,
};
const officialContext = { storeCode: STORE_CODE, orderType: 1, beType: 1 };
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const copy = value => structuredClone(value);

function safeImage(image) {
  try {
    const url = new URL(image);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function publicConfiguration(item) {
  return { productCode: item.productCode, quantity: item.quantity,
    roundList: (item.roundList ?? []).map(r => ({
      round: r.round, comboItemList: r.comboItemList.map(c => ({ code: c.code, quantity: c.quantity })),
    })) };
}

export class LiveSession {
  constructor({ token, connect = connectReadOnly, now = () => Date.now() } = {}) {
    this.token = token;
    this.connect = connect;
    this.now = now;
    this.context = copy(initialLiveContext);
    this.candidates = new Map();
    this.actions = new Map();
    this.entries = [];
    this.trace = [];
    this.cart = { version: 1, context: copy(this.context), lines: [], status: "valid" };
  }

  async call(name, args) {
    if (!this.token) throw new LiveError("TOKEN_REQUIRED", "请先连接自己的麦当劳账号。", 401);
    const started = this.now();
    try {
      if (!this.api) this.api = await this.connect(this.token);
      const data = await this.api.call(name, args);
      this.trace.push({ tool: name, ok: true, elapsedMs: this.now() - started });
      return data;
    } catch {
      this.trace.push({ tool: name, ok: false, elapsedMs: this.now() - started });
      throw new LiveError("MCP_UNAVAILABLE", "麦当劳服务暂时没有返回有效结果。请检查连接或稍后重试。", 502);
    } finally {
      this.trace = this.trace.slice(-100);
    }
  }

  async checkStore() {
    const stores = await this.call("query-nearby-stores", {
      beType: 1, searchType: 2, city: LIVE_STORE.city, keyword: LIVE_STORE.keyword,
    });
    const store = Array.isArray(stores) && stores.find(s => String(s.storeCode) === STORE_CODE);
    if (!store) throw new LiveError("STORE_NOT_FOUND", `没有找到${LIVE_STORE.storeName}，请稍后重试。`);
    this.context = { ...this.context, storeName: store.storeName, storeAddress: store.address };
    if (store.businessStatus !== true) {
      const hours = store.businessStartTime && store.businessEndTime
        ? `营业时间 ${store.businessStartTime}–${store.businessEndTime}。` : "";
      throw new LiveError("STORE_CLOSED", `${store.storeName}现在休息，${hours}营业后再来摇一份吧。`, 409);
    }
    return store;
  }

  makeQuote(data, items, cartVersion) {
    const summary = quoteSummary(data);
    const fee = key => {
      const value = data[key] ?? 0;
      if (!Number.isSafeInteger(value) || value < 0)
        throw new LiveError("PRICE_INVALID", "费用信息不完整，请重新核价。", 502);
      return value;
    };
    const now = this.now();
    return {
      id: randomUUID(), contextRevision: this.context.revision, cartVersion,
      configurationHash: hash(items), payableInFen: summary.payableInFen,
      originalInFen: summary.originalInFen, discountInFen: summary.discountInFen,
      packagingFeeInFen: fee("packingPrice"), deliveryFeeInFen: fee("deliveryPrice"),
      calculatedAt: new Date(now).toISOString(), softExpiresAt: new Date(now + 120000).toISOString(),
      takeWays: summary.takeWays.map(x => ({ code: x.code, label: x.title })),
      couponSummary: "按门店当前配置核价，未使用个人优惠券",
    };
  }

  async prepare(value) {
    const deadline = this.now() + 120000;
    const preference = validatePreference(value);
    await this.checkStore();
    const menu = await this.call("query-meals", officialContext);
    // Nutrition failure must not silently downgrade a requested balanced meal.
    let nutrition = new Map();
    try { nutrition = parseNutrition(await this.call("list-nutrition-foods", {})); }
    catch (error) { if (preference.mood === "balanced") throw error; }
    if (preference.mood === "balanced" && !nutrition.size)
      throw new LiveError("NUTRITION_MISSING", "暂时无法确认营养数据，请选其他心情或稍后再试。");
    const codes = menuCodes(menu, preference).slice(0, 24);
    const prepared = [];
    for (const code of codes) {
      if (prepared.length >= 5 || this.now() >= deadline) break;
      try {
        const detail = await this.call("query-meal-detail", { ...officialContext, code });
        if (String(detail?.code) !== code)
          throw new LiveError("CONFIGURATION", "餐品信息发生变化。");
        const configured = configureMeal(detail, preference, nutrition);
        const rawQuote = await this.call("calculate-price",
          { ...officialContext, items: [configured.item], needTableware: true });
        const now = new Date(this.now()).toISOString();
        const quote = this.makeQuote(rawQuote, [configured.item], this.cart.version);
        const id = randomUUID();
        const candidate = {
          id, mood: preference.mood,
          product: {
            code, name: detail.name, category: configured.category,
            spec: configured.components.map(c => `${c.name} ×${c.quantity}`).join("＋"),
            imageUrl: safeImage(detail.image ?? menu.meals[code].image),
          },
          configuration: publicConfiguration(configured.item),
          attributes: Object.entries(configured.attrs).map(([key, value]) => ({
            key, value, source: "official-menu/project-name-rules", checkedAt: now,
          })),
          reasons: [
            `来自${this.context.storeName}本次返回的菜单，已按完整配置重新核价。`,
            ...(preference.exclusions.length ? ["按已识别餐品名称筛选口味；这不是过敏原保证。"] : []),
            ...(configured.nutrition ? [
              `按官方营养表匹配估算：整份约 ${Math.round(configured.nutrition.kcal)} 千卡，蛋白质 ${Math.round(configured.nutrition.protein)} 克。`,
            ] : []),
          ],
          quote,
        };
        this.candidates.set(id, { candidate, item: configured.item, expires: this.now() + 120000 });
        prepared.push(candidate);
      } catch (error) {
        if (!(error instanceof LiveError)) continue;
        // A malformed or unavailable item is excluded; no historical price is substituted.
      }
    }
    for (const [id, saved] of this.candidates) {
      if (saved.expires < this.now()) this.candidates.delete(id);
    }
    const fresh = prepared.filter(candidate => this.candidates.has(candidate.id));
    if (!fresh.length)
      throw new LiveError("NO_MATCH", "当前菜单中没有找到资料完整、符合条件且成功核价的餐点。可以换个心情或减少口味限制。");
    return { candidates: fresh, context: copy(this.context), checkedAt: new Date(this.now()).toISOString() };
  }

  snapshot() {
    if (this.cart.quote && Date.parse(this.cart.quote.softExpiresAt) <= this.now())
      this.cart.status = "needs_refresh";
    return copy(this.cart);
  }

  checkVersion(version) {
    if (version !== this.cart.version)
      throw new LiveError("CART_CONFLICT", "购物车已更新，请刷新清单后再操作。", 409);
  }

  async priceEntries(entries) {
    if (!entries.length) return undefined;
    const items = entries.map(e => ({ ...copy(e.item), quantity: e.quantity }));
    const data = await this.call("calculate-price", { ...officialContext, items, needTableware: true });
    return this.makeQuote(data, items, this.cart.version + 1);
  }

  commit(entries, quote) {
    this.entries = entries;
    this.cart = {
      version: this.cart.version + 1, context: copy(this.context), status: "valid", quote,
      lines: entries.map(e => ({
        lineKey: e.lineKey, product: copy(e.candidate.product),
        configuration: publicConfiguration(e.item), quantity: e.quantity,
        attributes: copy(e.candidate.attributes), unitPriceInFen: e.candidate.quote.payableInFen,
      })),
    };
    return this.snapshot();
  }

  async add({ candidateId, actionId, version }) {
    if (typeof actionId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(actionId))
      throw new LiveError("ACTION", "请重新点击加入购物车。", 400);
    const previous = this.actions.get(actionId);
    if (previous) {
      if (previous.candidateId !== candidateId)
        throw new LiveError("ACTION_CONFLICT", "这次操作与之前的请求不一致。", 409);
      return this.snapshot();
    }
    this.checkVersion(version);
    const saved = this.candidates.get(candidateId);
    if (!saved || saved.expires < this.now())
      throw new LiveError("QUOTE_EXPIRED", "推荐价格已过期，请重新摇签后再加入。", 409);
    if (this.entries.reduce((n, e) => n + e.quantity, 0) >= 20)
      throw new LiveError("CART_LIMIT", "购物车最多保留20份餐点。");
    const entries = copy(this.entries);
    const lineKey = hash(saved.item);
    const found = entries.find(e => e.lineKey === lineKey);
    if (found) found.quantity++;
    else entries.push({ lineKey, item: copy(saved.item), candidate: copy(saved.candidate), quantity: 1 });
    let quote;
    try { await this.checkStore(); quote = await this.priceEntries(entries); }
    catch (error) { this.cart.status = "needs_refresh"; throw error; }
    const cart = this.commit(entries, quote);
    this.actions.set(actionId, { candidateId });
    if (this.actions.size > 200) this.actions.delete(this.actions.keys().next().value);
    return cart;
  }

  async change({ lineKey, quantity, version }) {
    this.checkVersion(version);
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 20
      || !this.entries.some(e => e.lineKey === lineKey))
      throw new LiveError("QUANTITY", "餐品或数量不正确。", 400);
    const entries = this.entries.map(e => ({ ...copy(e), quantity: e.lineKey === lineKey ? quantity : e.quantity }))
      .filter(e => e.quantity > 0);
    if (entries.reduce((n, e) => n + e.quantity, 0) > 20)
      throw new LiveError("CART_LIMIT", "购物车最多保留20份餐点。");
    try {
      if (entries.length) await this.checkStore();
      return this.commit(entries, await this.priceEntries(entries));
    }
    catch (error) { this.cart.status = "needs_refresh"; throw error; }
  }

  async refresh(version) {
    this.checkVersion(version);
    try {
      if (this.entries.length) await this.checkStore();
      return this.commit(copy(this.entries), await this.priceEntries(this.entries));
    }
    catch (error) { this.cart.status = "needs_refresh"; throw error; }
  }

  async close() { this.token = undefined; if (this.api) await this.api.close().catch(() => {}); }
}
