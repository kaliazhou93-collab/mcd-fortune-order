import { readFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { connectReadOnly, defaultMeal, quoteSummary } from "./mcp-core.mjs";

// A runnable companion for genuine read-only MCP use. No server, browser token or checkout.
const STORE = "1450398";
const SUPPORTED_MEALS = ["9900005466", "9900011128"];

export async function drawLive(api) {
  const stores = await api.call("query-nearby-stores", {
    beType: 1, searchType: 2, city: "上海", keyword: "龙腾大道",
  });
  if (!Array.isArray(stores)) throw new Error("门店返回格式无法确认。");
  const store = stores.find(s => String(s.storeCode) === STORE);
  if (!store) throw new Error("没有找到上海龙腾大道示例门店，请稍后再试。");
  if (store.businessStatus !== true)
    return { mode: "live", status: "store-unavailable", store: store.storeName,
      checkedAt: new Date().toISOString(), message: "门店当前未营业，未生成可购买推荐。", ordersCreated: 0 };
  const context = { storeCode: STORE, orderType: 1, beType: 1 };
  const menu = await api.call("query-meals", context);
  const available = SUPPORTED_MEALS.filter(code => menu?.meals?.[code] && !menu.meals[code].canWithOrder);
  const candidates = [];
  for (const code of available) {
    try {
      const detail = await api.call("query-meal-detail", { ...context, code });
      if (String(detail.code) !== code) throw new Error("商品编码不匹配。");
      const { item, components } = defaultMeal(detail);
      const price = await api.call("calculate-price", { ...context, items: [item], needTableware: true });
      candidates.push({ name: detail.name, code, components, quote: quoteSummary(price) });
    } catch {
      // Invalid candidates are excluded, never priced from fixtures.
    }
  }
  if (candidates.length === 0) throw new Error("当前没有成功核价的支持套餐，未生成推荐。");
  const fortunes = JSON.parse(await readFile(new URL("../data/fortunes.json", import.meta.url), "utf8"));
  return { mode: "live", status: "quoted", store: store.storeName, storeCode: STORE,
    checkedAt: new Date().toISOString(),
    fortune: fortunes[randomInt(fortunes.length)], meal: candidates[randomInt(candidates.length)],
    coupon: "此只读入口不使用优惠券，也不购买会员权益。",
    note: "此入口仅对两种受支持主餐的当前默认配置核价；不执行网页偏好筛选或健康认证。",
    ordersCreated: 0 };
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("npm run mcp:draw：从本机MCD_MCP_TOKEN连接官方服务，查询龙腾大道门店、支持套餐和实际报价后抽签。仅查询，不建单。\nnpm run mcp:check：查询官方营养表，验证MCP连接。不输出账户资料。");
    return;
  }
  let api;
  try {
    api = await connectReadOnly(process.env.MCD_MCP_TOKEN);
    if (process.argv.includes("--check")) {
      const nutrition = await api.call("list-nutrition-foods", {});
      console.log(JSON.stringify({ mode: "live", tool: "list-nutrition-foods",
        checkedAt: new Date().toISOString(), responseType: typeof nutrition,
        hasData: Boolean(nutrition), ordersCreated: 0 }, null, 2));
    } else console.log(JSON.stringify(await drawLive(api), null, 2));
  } catch (error) {
    // Network errors may contain request details. Never print SDK error objects or credentials.
    const safe = error instanceof Error && /^(请在本机|MCP业务|门店|没有找到|当前没有|套餐|此入口|计价|餐品|特调|轮次)/.test(error.message);
    console.error(safe ? error.message : "MCP连接或响应校验失败。请核对本机Token、网络与门店状态；未创建订单。");
    process.exitCode = 1;
  } finally {
    if (api) await api.close().catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
