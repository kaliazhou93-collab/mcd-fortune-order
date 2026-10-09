// 核心领域模型。严格对应 docs/ARCHITECTURE.md 的「核心模型」。
// 这些类型同时服务于 UI 与（未来的）服务端 MCP 适配，保证金额、属性三态与版本语义一致。

/** 用餐方式。首个里程碑先跑通到店；外送入口显示「开发中」。 */
export type Mode = "demo" | "live";
export type BeType = 1 | 2; // 1=到店, 2=外送
export type OrderType = 1 | 2; // 1=到店, 2=外送

/** 心情：放纵 / 均衡 / 小确幸。无默认预选。 */
export type Mood = "treat" | "balanced" | "snack";

/** 可跳过的偏好。前五项可多选；"anything" 与其它互斥。 */
export type Exclusion =
  | "no-spicy"
  | "no-beef"
  | "no-fish"
  | "no-coffee"
  | "no-sugary-drink"
  | "anything";

/** 属性三态，禁止把 unknown 当作已满足硬排除。 */
export type Tristate = true | false | "unknown";

/** 签文等级。保留原结构：超级大吉 / 大吉 / 中吉 / 小吉。 */
export type FortuneGrade = "超级大吉" | "大吉" | "中吉" | "小吉";

/** 场景图：庆祝 / 普通 / 安慰。 */
export type FortuneScene = "celebration" | "welcome" | "comfort";

export interface Context {
  mode: Mode;
  storeCode: string;
  storeName: string;
  storeAddress: string;
  beType: BeType;
  orderType: OrderType;
  addressRef?: string;
  beCode?: string;
  /** 切门店/方式/地址递增，异步旧结果只可丢弃。 */
  revision: number;
}

export interface Preference {
  mood: Mood;
  exclusions: Exclusion[];
  /** 偏好版本，与 Context.revision 独立。 */
  revision: number;
}

export interface FoodAttribute {
  /** 稳定键，用于程序判断，例如 "spicy" | "beef"。 */
  key: string;
  value: Tristate;
  /** 来源，例如 "nutrition-table" | "menu-tag" | "fixture"。 */
  source: string;
  /** 规格说明，避免每 100g 与每份混算。 */
  spec?: string;
  checkedAt: string;
}

/** 套餐轮次中的一个可选项。 */
export interface RoundChoice {
  code: string;
  name: string;
  quantity: number;
  isDefault: boolean;
}

export interface Round {
  round: string;
  minQuantity: number;
  maxQuantity: number;
  choices: RoundChoice[];
}

/** 特调（去冰/加料等）。 */
export interface Modification {
  selectedKey: string[];
  unselectedKey: string[];
  selectedQuantity: Record<string, number>;
}

export interface MealConfiguration {
  productCode: string;
  quantity: number;
  roundList: Array<{
    round: string;
    comboItemList: Array<{
      code: string;
      quantity: number;
      modification?: Modification;
    }>;
  }>;
  /** 会话内引用，原始券码不发前端。 */
  couponRef?: string;
}

/** 报价。内部金额用整数分，边界逐字段转换。 */
export interface Quote {
  id: string;
  contextRevision: number;
  cartVersion: number;
  configurationHash: string;
  /** 本次应付（分）。 */
  payableInFen: number;
  /** 原价（分），可能与应付相等（如巨无霸 discount=0）。 */
  originalInFen: number;
  /** 已享优惠（分），由服务端核算，不叠加菜单原价差。 */
  discountInFen: number;
  packagingFeeInFen: number;
  deliveryFeeInFen: number;
  calculatedAt: string;
  /** 本地软过期（产品保守策略，非官方有效期承诺）。 */
  softExpiresAt: string;
  takeWays: TakeWay[];
  couponSummary?: string;
}

export type TakeWayCode = "eat-in" | "locker-in" | "locker-out" | "delivery";
export interface TakeWay {
  code: TakeWayCode;
  label: string;
}

/** 一个候选幸运餐（已核价）。 */
export interface Candidate {
  /** opaque 候选 ID，由服务端生成；UI 不据此计算价格。 */
  id: string;
  mood: Mood;
  product: ProductSummary;
  configuration: MealConfiguration;
  attributes: FoodAttribute[];
  /** 与偏好匹配的事实理由，只有来源支持才写。 */
  reasons: string[];
  quote: Quote;
}

export interface ProductSummary {
  code: string;
  name: string;
  spec?: string;
  /** 缩略图相对路径；失败由 UI 用中性图标兜底。 */
  imageUrl?: string;
  /** 商品类别：主餐/套餐/小食/甜品/饮品。 */
  category: "combo" | "main" | "snack" | "dessert" | "drink";
}

export interface Fortune {
  id: string;
  grade: FortuneGrade;
  title: string;
  message: string;
  scene: FortuneScene;
}

export type CartStatus = "valid" | "needs_refresh" | "pricing" | "invalid";

export interface CartLine {
  /** 合并键：商品 + 完整配置 + 券适用语义。 */
  lineKey: string;
  product: ProductSummary;
  configuration: MealConfiguration;
  quantity: number;
  attributes: FoodAttribute[];
  /** 该行最近一次有效单价（分）。 */
  unitPriceInFen: number;
}

export interface Cart {
  version: number;
  context: Context;
  lines: CartLine[];
  quote?: Quote;
  status: CartStatus;
}
