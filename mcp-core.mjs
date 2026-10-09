import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const TOOLS = new Set([
  "query-nearby-stores", "query-meals", "query-meal-detail",
  "calculate-price", "list-nutrition-foods",
]);

export function unwrap(result) {
  if (result?.isError) throw new Error("MCP工具执行失败，未生成推荐。");
  let body = result?.structuredContent;
  if (!body) {
    const text = result?.content?.filter(c => c.type === "text").map(c => c.text).join("\n");
    try { body = JSON.parse(text); }
    catch { throw new Error("MCP返回格式无法确认，未使用示例数据替代。"); }
  }
  if (body?.success !== true || Number(body.code) !== 200)
    throw new Error(`MCP业务未成功（code=${Number(body?.code) || "unknown"}），请核对门店或稍后重试。`);
  return body.data;
}

export async function connectReadOnly(token) {
  if (!token?.trim()) throw new Error("请在本机环境变量MCD_MCP_TOKEN中配置自己的Token。");
  const client = new Client({ name: "mcd-fortune-order", version: "0.1.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.mcd.cn"), {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: "error" },
  });
  await client.connect(transport, { timeout: 25000 });
  return {
    async call(name, args) {
      if (!TOOLS.has(name)) throw new Error("此入口只支持查询和核价，不支持建单或账户写操作。");
      return unwrap(await client.callTool({ name, arguments: args }, undefined, { timeout: 25000 }));
    },
    async close() { await client.close(); },
  };
}

function quantity(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}无有效数量。`);
  return value;
}

function defaultModification(modification) {
  if (!modification?.items) return undefined;
  const values = [];
  for (const group of modification.items) {
    for (const value of group.values ?? []) {
      const n = quantity(value.selectedQuantity ?? 0, "特调");
      const key = n > 0 ? value.selectedKey : value.unselectedKey;
      if (n > 0 && !key) throw new Error("特调缺少默认选项，需人工选择。");
      if (key) values.push({ code: String(value.code), key, quantity: n });
    }
  }
  return values.length ? { values } : undefined;
}

export function defaultMeal(detail) {
  if (!detail?.code || !Array.isArray(detail.rounds) || detail.rounds.length === 0)
    throw new Error("此入口仅支持已提供完整轮次的套餐，当前商品不支持自动选择。");
  const components = [];
  const roundList = detail.rounds.map(round => {
    const items = (round.choices ?? []).filter(c => quantity(c.quantity ?? 0, "餐品") > 0);
    const total = items.reduce((n, c) => n + c.quantity, 0);
    if (total < quantity(round.minQuantity, "轮次下限")
        || (round.maxQuantity >= 0 && total > round.maxQuantity))
      throw new Error("套餐默认配置不满足限选数量，需人工选择。");
    if (round.id == null) throw new Error("套餐缺少轮次编码。");
    return {
      round: String(round.id),
      comboItemList: items.map(choice => {
        if (!choice.code) throw new Error("套餐缺少子餐品编码。");
        if (choice.maxQuantity >= 0 && choice.quantity > choice.maxQuantity)
          throw new Error("默认子餐品数量超过上限。");
        components.push({ name: choice.name, quantity: choice.quantity });
        const modification = defaultModification(choice.modification);
        return { code: String(choice.code), quantity: choice.quantity, ...(modification ? { modification } : {}) };
      }),
    };
  });
  return { item: { productCode: String(detail.code), quantity: 1, roundList }, components };
}

export function quoteSummary(data) {
  for (const key of ["price", "originalPrice", "discount"]) {
    if (!Number.isSafeInteger(data?.[key]) || data[key] < 0)
      throw new Error("计价金额缺失或单位无法确认，未生成推荐。");
  }
  return {
    payableInFen: data.price,
    originalInFen: data.originalPrice,
    discountInFen: data.discount,
    takeWays: (data.takeWayList ?? []).map(x => ({ code: x.code, title: x.title, subtitle: x.subtitle })),
  };
}
