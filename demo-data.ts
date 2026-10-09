import type { Candidate, Context, FoodAttribute, Quote } from "./types";

// 演示 fixture 数据。
// 明确声明：这是 fixture，不是实时数据。金额取自 2026-10-09 龙腾大道历史只读验证，
// 仅作演示示例，不代表今日价格承诺；真实模式由服务端 MCP 另行查询。

export const DEMO_STORE: Pick<
  Context,
  "storeCode" | "storeName" | "storeAddress"
> = {
  storeCode: "1450398",
  storeName: "麦当劳上海龙腾大道餐厅（示例门店）",
  storeAddress: "龙腾大道2121号巨无霸魔方1F2F",
};

/** 历史验证时间，用于结果页「xx 更新」显示具体日期。 */
export const DEMO_PRICE_CHECKED_AT = "2026-10-09T21:37:13.777+08:00";

const DEMO_TAKE_WAYS: Quote["takeWays"] = [
  { code: "eat-in", label: "堂食店内用餐" },
  { code: "locker-in", label: "外带店内柜" },
  { code: "locker-out", label: "外带店外柜" },
];

function attr(
  key: string,
  value: FoodAttribute["value"],
  spec?: string,
): FoodAttribute {
  return {
    key,
    value,
    source: "fixture",
    spec,
    checkedAt: DEMO_PRICE_CHECKED_AT,
  };
}

function demoQuote(
  id: string,
  payableInFen: number,
  originalInFen: number,
  options: { discountInFen?: number; couponSummary?: string } = {},
): Quote {
  const checked = new Date(DEMO_PRICE_CHECKED_AT).getTime();
  return {
    id,
    contextRevision: 0,
    cartVersion: 0,
    configurationHash: id,
    payableInFen,
    originalInFen,
    discountInFen: options.discountInFen ?? 0,
    packagingFeeInFen: 0,
    deliveryFeeInFen: 0,
    calculatedAt: DEMO_PRICE_CHECKED_AT,
    softExpiresAt: new Date(checked + 2 * 60_000).toISOString(),
    takeWays: DEMO_TAKE_WAYS,
    couponSummary: options.couponSummary,
  };
}

// 候选集合：覆盖三种心情、含一个 unknown 属性用于演示保守排除。
export const DEMO_CANDIDATES: Candidate[] = [
  {
    id: "cand-bigmac-cola",
    mood: "treat",
    product: {
      code: "9900005466",
      name: "巨无霸套餐",
      spec: "巨无霸 + 中薯条 + 中杯可乐",
      category: "combo",
    },
    configuration: {
      productCode: "9900005466",
      quantity: 1,
      roundList: [
        {
          round: "main",
          comboItemList: [{ code: "1100", quantity: 1 }],
        },
        {
          round: "side",
          comboItemList: [{ code: "4810", quantity: 1 }],
        },
        {
          round: "drink",
          comboItemList: [{ code: "3050", quantity: 1 }],
        },
      ],
    },
    attributes: [
      attr("spicy", false),
      attr("beef", true, "牛肉饼"),
      attr("fish", false),
      attr("coffee", false),
      attr("sugaryDrink", true, "可乐含糖"),
    ],
    reasons: ["巨无霸搭配中薯条和中杯可乐", "历史核价示例，未使用指定优惠券"],
    quote: demoQuote("cand-bigmac-cola", 3750, 3750, { discountInFen: 0 }),
  },
  {
    id: "cand-bigmac-corn-nosugar",
    mood: "balanced",
    product: {
      code: "9900005466",
      name: "巨无霸套餐（玉米 + 无糖可乐）",
      spec: "巨无霸 + 小杯玉米杯 + 中杯无糖可乐",
      category: "combo",
    },
    configuration: {
      productCode: "9900005466",
      quantity: 1,
      roundList: [
        { round: "main", comboItemList: [{ code: "1100", quantity: 1 }] },
        { round: "side", comboItemList: [{ code: "4437", quantity: 1 }] },
        { round: "drink", comboItemList: [{ code: "3071", quantity: 1 }] },
      ],
    },
    attributes: [
      attr("spicy", false),
      attr("beef", true, "牛肉饼"),
      attr("fish", false),
      attr("coffee", false),
      attr("sugaryDrink", false, "无糖可乐"),
    ],
    reasons: ["搭配无糖饮料", "配餐换成玉米杯，口感更清爽"],
    quote: demoQuote("cand-bigmac-corn-nosugar", 3650, 3650),
  },
  {
    id: "cand-happy-chicken",
    mood: "balanced",
    product: {
      code: "9900011128",
      name: "“堡”你欢乐套餐",
      spec: "汉堡包 + 麦乐鸡4块 + 苹果片60g + 中杯无糖可乐",
      category: "combo",
    },
    configuration: {
      productCode: "9900011128",
      quantity: 1,
      roundList: [
        { round: "main", comboItemList: [{ code: "1000", quantity: 1 }] },
        { round: "nugget", comboItemList: [{ code: "515106", quantity: 1 }] },
        { round: "fruit", comboItemList: [{ code: "6102", quantity: 1 }] },
        { round: "drink", comboItemList: [{ code: "3071", quantity: 1 }] },
      ],
    },
    attributes: [
      attr("spicy", false),
      attr("beef", "unknown", "含汉堡包，未逐项验证成分，不按无牛肉推荐"),
      attr("fish", false),
      attr("coffee", false),
      attr("sugaryDrink", false, "无糖可乐"),
    ],
    // 营养逐项总量尚未核验，不写健康认证。
    reasons: ["含汉堡包、鸡块、苹果片与无糖饮料", "营养总量尚未逐项核验，仅作口味参考"],
    quote: demoQuote("cand-happy-chicken", 2800, 2800),
  },
  {
    id: "cand-strawberry-mcflurry",
    mood: "snack",
    product: {
      code: "9900014239",
      name: "草莓麦旋风",
      spec: "1份",
      category: "dessert",
    },
    configuration: {
      productCode: "9900014239",
      quantity: 1,
      roundList: [{ round: "main", comboItemList: [{ code: "4900", quantity: 1 }] }],
      couponRef: "demo-coupon-ref",
    },
    attributes: [
      attr("spicy", false),
      attr("beef", false),
      attr("fish", false),
      attr("coffee", false),
      // 甜品天然含糖，但这不是「含糖饮料」；no-sugary-drink 不应排除它。
      attr("sugaryDrink", false, "甜品非饮料"),
    ],
    reasons: ["一份小确幸甜品", "示例券仅为当次账户报价，非人人可享"],
    quote: demoQuote("cand-strawberry-mcflurry", 990, 1400, {
      discountInFen: 410,
      couponSummary: "示例优惠券（历史示例，条件优惠，非默认人人可享）",
    }),
  },
];
