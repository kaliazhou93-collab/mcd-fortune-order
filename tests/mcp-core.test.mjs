import { test } from "node:test";
import assert from "node:assert/strict";
import { unwrap, defaultMeal, quoteSummary } from "../scripts/mcp-core.mjs";
import { drawLive } from "../scripts/mcp-draw.mjs";
import { LIVE_STORE } from "../server/store.mjs";

test("protocol and business failures cannot become a successful meal", () => {
  assert.throws(() => unwrap({ isError: true }));
  assert.throws(() => unwrap({ content: [{ type: "text", text: "not JSON" }] }));
  assert.throws(() => unwrap({ structuredContent: { success: false, code: 200 } }));
  assert.equal(unwrap({ content: [{ type: "text", text: '{"success":true,"code":200,"data":"ok"}' }] }), "ok");
});
test("default quantity, not isDefault, selects one flavour", () => {
  const detail = { code: "sample", rounds: [{ id: 1, minQuantity: 1, maxQuantity: 1, choices: [
    { code: "a", name: "A", quantity: 1, isDefault: 1, maxQuantity: 1,
      modification: { items: [{ values: [
        { code: "extra", selectedQuantity: 0, selectedKey: "yes", unselectedKey: "no" },
      ] }] } },
    { code: "b", name: "B", quantity: 0, isDefault: 1, maxQuantity: 1 },
  ] }] };
  const { item } = defaultMeal(detail);
  assert.equal(item.roundList[0].comboItemList.length, 1);
  assert.deepEqual(item.roundList[0].comboItemList[0].modification.values,
    [{ code: "extra", key: "no", quantity: 0 }]);
});
test("invalid defaults and absent amounts fail closed", () => {
  assert.throws(() => defaultMeal({ code: "sample", rounds: [{ id: 1, minQuantity: 1, maxQuantity: 1, choices: [] }] }));
  assert.throws(() => quoteSummary({ price: 3750, discount: 0 }));
  assert.equal(quoteSummary({ price: 3750, originalPrice: 3750, discount: 0 }).payableInFen, 3750);
});
test("closed store stops without any menu, quote or order call", async () => {
  const calls = [];
  const output = await drawLive({ async call(name) {
    calls.push(name); return [{ storeCode: LIVE_STORE.storeCode, storeName: "测试店", businessStatus: false }];
  } });
  assert.equal(output.status, "store-unavailable");
  assert.deepEqual(calls, ["query-nearby-stores"]);
  assert.equal(output.ordersCreated, 0);
});
test("successful live workflow only exposes the fresh quote and a fortune", async () => {
  const calls = [];
  const output = await drawLive({ async call(name) {
    calls.push(name);
    if (name === "query-nearby-stores") return [{ storeCode: LIVE_STORE.storeCode, storeName: "测试店", businessStatus: true }];
    if (name === "query-meals") return { meals: { "9900005466": { canWithOrder: false } } };
    if (name === "query-meal-detail") return { code: "9900005466", name: "测试套餐", rounds: [
      { id: 1, minQuantity: 1, maxQuantity: 1, choices: [{ code: "1100", name: "测试主餐", quantity: 1, maxQuantity: 1 }] },
    ] };
    if (name === "calculate-price") return { price: 3900, originalPrice: 3900, discount: 0 };
    throw new Error("unexpected tool");
  } });
  assert.equal(output.meal.quote.payableInFen, 3900);
  assert.match(output.fortune.id, /^fortune-\d{3}$/);
  assert.equal(output.ordersCreated, 0);
  assert.deepEqual(calls, ["query-nearby-stores", "query-meals", "query-meal-detail", "calculate-price"]);
});
test("quote failure never falls back to historical prices", async () => {
  await assert.rejects(() => drawLive({ async call(name) {
    if (name === "query-nearby-stores") return [{ storeCode: LIVE_STORE.storeCode, businessStatus: true }];
    if (name === "query-meals") return { meals: { "9900005466": {} } };
    throw new Error("failed");
  } }), /没有成功核价/);
});
