import { LIVE_STORE } from "../../server/store.mjs";
// Contract fixture, never a production fallback. No real account, menu or prices.
export function fakeMcp() {
  const state = { open: true, price: 2800, failPrice: false, calls: [] };
  const details = {
    combo: { code: "combo", name: "板烧鸡腿堡套餐", rounds: [
      { id: 1, minQuantity: 1, maxQuantity: 1, choices: [
        { code: "main", name: "板烧鸡腿堡", quantity: 1, maxQuantity: 1 },
      ] },
      { id: 2, minQuantity: 1, maxQuantity: 1, choices: [
        { code: "fries", name: "中薯条", quantity: 1, maxQuantity: 1 },
        { code: "corn", name: "小杯玉米杯", quantity: 0, maxQuantity: 1 },
      ] },
      { id: 3, minQuantity: 1, maxQuantity: 1, choices: [
        { code: "cola", name: "可口可乐（中）", quantity: 1, maxQuantity: 1 },
        { code: "zero", name: "无糖可口可乐（中）", quantity: 0, maxQuantity: 1 },
      ] },
    ] },
    beef: { code: "beef", name: "巨无霸" },
    snack: { code: "snack", name: "小薯条" },
  };
  const nutrition = `[6]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
板烧鸡腿堡,每份,1636,391,23,0,0,0,0
中薯条,每份,1209,289,4,0,0,0,0
小杯玉米杯,每份,222,53,2,0,0,0,0
可乐中杯,每份,680,163,0,0,0,0,0
无糖可乐中杯,每份,0,0,0,0,0,0,0
巨无霸,每份,2146,513,27,0,0,0,0`;
  const connect = async () => ({
    async call(name, args) {
      state.calls.push({ name, args: structuredClone(args) });
      if (name === "query-nearby-stores") return [{
        storeCode: LIVE_STORE.storeCode, storeName: LIVE_STORE.storeName, address: LIVE_STORE.storeAddress,
        businessStatus: state.open, businessStartTime: "07:00", businessEndTime: "22:00",
      }];
      if (name === "query-meals") return { meals: Object.fromEntries(Object.entries(details)
        .map(([code, d]) => [code, { name: d.name, currentPrice: "0.01" }])) };
      if (name === "query-meal-detail") return structuredClone(details[args.code]);
      if (name === "list-nutrition-foods") return nutrition;
      if (name === "calculate-price") {
        if (state.failPrice) throw new Error("upstream account-specific detail must not leak");
        const count = args.items.reduce((n, item) => n + item.quantity, 0);
        return { price: state.price * count, originalPrice: 3500 * count,
          discount: (3500 - state.price) * count, packingPrice: 0, deliveryPrice: 0,
          takeWayList: [{ code: "eat-in", title: "堂食" }] };
      }
      throw new Error(`Unexpected tool: ${name}`);
    },
    async close() {},
  });
  return { state, connect, details, nutrition };
}
