import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveSession } from "../../server/session.mjs";
import { configureMeal, parseNutrition, validatePreference, normalizeName, categoryFor } from "../../server/catalog.mjs";
import { fakeMcp } from "./fake-mcp.mjs";
import { startServer } from "../../server/index.mjs";
const preference = { mood: "treat", exclusions: ["no-beef", "no-sugary-drink"] };
function fixture() {
  const fake = fakeMcp();
  const clock = { value: Date.now() };
  return { ...fake, clock, session: new LiveSession({ token: "contract-test-token",
    connect: fake.connect, now: () => clock.value }) };
}

test("preferences substitute actual menu options, price comes from calculate-price", async () => {
  const { session, state } = fixture();
  const result = await session.prepare(preference);
  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.quote.payableInFen, 2800);
  assert.match(candidate.product.spec, /无糖/);
  assert.equal(candidate.attributes.find(a => a.key === "beef").value, false);
  assert.equal(state.calls.find(c => c.name === "calculate-price").args.items[0]
    .roundList[2].comboItemList[0].code, "zero");
});
test("balanced meals use matching serving nutrition and reject unknown data", () => {
  const { details, nutrition } = fakeMcp();
  const pref = { mood: "balanced", exclusions: [] };
  const result = configureMeal(details.combo, pref, parseNutrition(nutrition));
  assert.equal(result.nutrition.kcal, 444);
  assert.equal(result.nutrition.protein, 25);
  assert.throws(() => configureMeal(details.combo, pref, new Map()), /营养/);
  assert.throws(() => configureMeal({ code: "x", name: "神秘汉堡" }, preference, new Map()), /资料不足/);
  assert.throws(() => validatePreference({ mood: "treat", exclusions: ["bad"] }));
});
test("serving aliases retain sizes and counts; per-100g data is not treated as one portion", () => {
  assert.equal(normalizeName("薯条（中）"), "中薯条");
  assert.equal(normalizeName("中薯"), "中薯条");
  assert.equal(normalizeName("玉米杯（小）"), "小杯玉米杯");
  assert.equal(normalizeName("可口可乐（中）"), "可乐中杯");
  assert.notEqual(normalizeName("麦乐鸡4块"), normalizeName("麦乐鸡5块"));
  for (const name of ["巨无霸", "麦香鸡", "麦香鱼"]) assert.equal(categoryFor(name), "main");
  const { nutrition } = fakeMcp();
  assert.equal(parseNutrition(nutrition.replace("板烧鸡腿堡,每份,", "板烧鸡腿堡,每100克,")).has("板烧鸡腿堡"), false);
});
test("duplicate substitutions cannot exceed per-choice maximum", () => {
  const { details, nutrition } = fakeMcp();
  const round = details.combo.rounds[1];
  round.minQuantity = 2; round.maxQuantity = 2;
  round.choices[0].quantity = 1; round.choices[1].quantity = 1;
  assert.throws(() => configureMeal(details.combo, { mood: "balanced", exclusions: [] },
    parseNutrition(nutrition)), /数量不正确/);
});
test("closed store stops before fetching menu, no demo fallback", async () => {
  const { session, state } = fixture();
  state.open = false;
  await assert.rejects(() => session.prepare(preference), e => e.code === "STORE_CLOSED");
  assert.deepEqual(state.calls.map(c => c.name), ["query-nearby-stores"]);
});
test("cart uses fresh full-cart price, retries are idempotent, input prices ignored", async () => {
  const { session, state } = fixture();
  const { candidates: [candidate] } = await session.prepare(preference);
  state.price = 3000;
  const input = { candidateId: candidate.id, actionId: "test-action-0001", version: 1,
    price: 1, items: [{ productCode: "tampered" }] };
  const cart = await session.add(input);
  assert.equal(cart.quote.payableInFen, 3000);
  assert.equal(cart.lines[0].quantity, 1);
  assert.equal((await session.add(input)).lines[0].quantity, 1);
  const updated = await session.change({ lineKey: cart.lines[0].lineKey, quantity: 2, version: cart.version });
  assert.equal(updated.quote.payableInFen, 6000);
  assert.equal(state.calls.at(-1).args.items[0].productCode, "combo");
  assert.ok(state.calls.every(c => !/order|pay|coupon/.test(c.name)));
});
test("failed repricing preserves quantities and marks previous quote stale", async () => {
  const { session, state } = fixture();
  const { candidates: [candidate] } = await session.prepare(preference);
  const cart = await session.add({ candidateId: candidate.id, actionId: "test-action-0001", version: 1 });
  state.failPrice = true;
  await assert.rejects(() => session.change({ lineKey: cart.lines[0].lineKey, quantity: 2, version: cart.version }),
    e => e.code === "MCP_UNAVAILABLE" && !e.message.includes("account-specific"));
  assert.equal(session.snapshot().lines[0].quantity, 1);
  assert.equal(session.snapshot().status, "needs_refresh");
});
test("candidate expiry, stale versions, invalid quantities and cross-session IDs fail", async () => {
  const { session, clock, connect } = fixture();
  const { candidates: [candidate] } = await session.prepare(preference);
  const add = { candidateId: candidate.id, actionId: "test-action-0001", version: 1 };
  const other = new LiveSession({ token: "different-user-token", connect });
  await assert.rejects(() => other.add(add), e => e.code === "QUOTE_EXPIRED");
  await assert.rejects(() => session.add({ ...add, version: 100 }), e => e.code === "CART_CONFLICT");
  const cart = await session.add(add);
  await assert.rejects(() => session.change({ lineKey: cart.lines[0].lineKey, quantity: 1.5, version: cart.version }),
    e => e.code === "QUANTITY");
  clock.value += 120001;
  assert.equal(session.snapshot().status, "needs_refresh");
  await assert.rejects(() => session.add({ ...add, actionId: "test-action-0002", version: cart.version }),
    e => e.code === "QUOTE_EXPIRED");
});
test("HTTP session boundaries, CSRF, real-mode marker and no ordering endpoint", async () => {
  const { connect } = fakeMcp();
  const app = await startServer({ port: 0, token: "contract-test-token", connect });
  try {
    const initial = await fetch(`${app.origin}/api/session`);
    const cookie = initial.headers.get("set-cookie").split(";")[0];
    const data = await initial.json();
    const headers = { Cookie: cookie, Origin: app.origin, "X-CSRF-Token": data.csrf, "Content-Type": "application/json" };
    assert.equal(data.connected, true);
    assert.equal(JSON.stringify(data).includes("contract-test-token"), false);
    const post = (path, body, h = headers) => fetch(app.origin + path,
      { method: "POST", headers: h, body: JSON.stringify(body) });
    assert.equal((await post("/api/prepare", { preference }, { ...headers, Origin: "https://evil.example" })).status, 403);
    assert.equal((await post("/api/prepare", { preference }, { ...headers, "X-CSRF-Token": "bad" })).status, 403);
    assert.equal((await post("/api/prepare", { preference }, { ...headers, Cookie: "" })).status, 401);
    assert.equal((await post("/api/create-order", {})).status, 404);
    const result = await post("/api/prepare", { preference });
    assert.equal(result.status, 200);
    const { candidates: [candidate] } = await result.json();
    const add = await post("/api/cart/add", { candidateId: candidate.id, actionId: "http-action-0001", version: 1 });
    assert.equal(add.status, 200);
    assert.equal((await add.json()).quote.payableInFen, 2800);
    const restored = await fetch(`${app.origin}/api/session`, { headers: { Cookie: cookie } });
    assert.equal((await restored.json()).cart.lines.length, 1);
    const html = await (await fetch(app.origin)).text();
    assert.match(html, /<meta name="mcd-mode" content="live">/);
    assert.equal((await fetch(`${app.origin}/server/index.mjs`)).status, 404);
    assert.equal((await post("/api/disconnect", {})).status, 200);
    const after = await (await fetch(`${app.origin}/api/session`, { headers: { Cookie: cookie } })).json();
    assert.equal(after.connected, false);
    assert.equal(after.cart.lines.length, 0);
  } finally { await app.close(); }
});
