import { defaultModification } from "../scripts/mcp-core.mjs";

export class LiveError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const attributeKeys = ["spicy", "beef", "fish", "coffee", "sugaryDrink"];
const exclusions = {
  "no-spicy": "spicy", "no-beef": "beef", "no-fish": "fish",
  "no-coffee": "coffee", "no-sugary-drink": "sugaryDrink",
};

export function validatePreference(value) {
  if (!value || !["treat", "balanced", "snack"].includes(value.mood)
    || !Array.isArray(value.exclusions) || value.exclusions.length > 6
    || value.exclusions.some(x => x !== "anything" && !Object.hasOwn(exclusions, x)))
    throw new LiveError("INVALID_PREFERENCE", "请选择今天的心情和口味。", 400);
  return { mood: value.mood, exclusions: [...new Set(value.exclusions.filter(x => x !== "anything"))] };
}

// Only explicit names/serving aliases are merged; numbers such as 4/5 nuggets are preserved.
export function normalizeName(name) {
  return String(name ?? "").replace(/[\s（()）·®™]/g, "").replace(/可口可乐/g, "可乐")
    .replace(/^(无糖可乐|可乐|雪碧|阳光柠檬红茶)(大|中|小)$/, "$1$2杯")
    .replace(/^(大|中|小)(无糖可乐|可乐|雪碧|阳光柠檬红茶)$/, "$2$1杯")
    .replace(/^(大|中|小)杯(无糖可乐|可乐|雪碧|阳光柠檬红茶)$/, "$2$1杯")
    .replace(/^(玉米杯)(大|小)(杯)?$/, "$2杯$1")
    .replace(/^(大|中|小)份薯条$/, "$1薯条")
    .replace(/^薯条(大|中|小)$/, "$1薯条").replace(/^(大|中|小)薯$/, "$1薯条")
    .replace(/^苹果片60[gG]$/, "苹果片")
    .replace(/^原味板烧鸡腿堡$/, "板烧鸡腿堡");
}

function csvRow(line) {
  const out = [];
  let field = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { out.push(field.trim()); field = ""; }
    else field += c;
  }
  out.push(field.trim());
  return out;
}

export function parseNutrition(text) {
  const rows = new Map();
  if (typeof text !== "string") return rows;
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.includes("{productName,nutritionDescription,energyKj,energyKcal,protein,"))
    return rows;
  for (const line of lines.slice(1)) {
    const fields = csvRow(line);
    if (fields.length !== 9 || !fields[0] || /(?:100|一百)\s*(?:g|ml|克|毫升)/i.test(fields[1])) continue;
    const kcal = Number(fields[3]), protein = Number(fields[4]);
    if (!fields[3] || !fields[4] || !Number.isFinite(kcal) || kcal < 0
      || !Number.isFinite(protein) || protein < 0) continue;
    const key = normalizeName(fields[0]);
    const previous = rows.get(key);
    if (previous && (previous.kcal !== kcal || previous.protein !== protein)) {
      rows.set(key, { ambiguous: true });
    } else if (!previous?.ambiguous) {
      rows.set(key, { name: fields[0], kcal, protein });
    }
  }
  return rows;
}

// Small, auditable product-name rules for taste preferences, not allergen certification.
// Unknown products and renamed/seasonal recipes do not inherit a "free of" assertion.
const profiles = new Map();
function register(names, overrides = {}) {
  for (const name of names.split("|")) profiles.set(normalizeName(name),
    { spicy: false, beef: false, fish: false, coffee: false, sugaryDrink: false, ...overrides });
}
register("巨无霸|汉堡包|吉士汉堡包|双层吉士汉堡|培根蔬萃双层牛堡|不素之霸双层牛堡|培根安格斯厚牛堡|芝士安格斯厚牛堡", { beef: true });
register("麦香鱼|双层深海鳕鱼堡|儿童鱼排堡", { fish: true });
register("麦辣鸡腿汉堡|麦辣鸡翅-2块", { spicy: true });
register("麦香鸡|板烧鸡腿堡|猪柳麦满分|猪柳蛋麦满分|烟肉蛋麦满分|火腿扒麦满分|大脆鸡扒麦满分|原味板烧鸡腿麦满分|双层原味板烧鸡腿麦满分|猪柳炒双蛋堡|麦乐鸡4块|麦乐鸡5块|那么大鸡排|中薯条|大薯条|小薯条|迷你薯条|脆薯饼|脆香油条|小杯玉米杯|大杯玉米杯|苹果片|香芋派|菠萝派|圆筒冰淇淋|奥利奥麦旋风|草莓麦旋风|朱古力新地|草莓新地|纯牛奶盒装|纯悦|锡兰红茶");
for (const size of ["小", "中", "大"]) {
  register(`无糖可乐${size}杯`);
  register(`可乐${size}杯|雪碧${size}杯|阳光柠檬红茶${size}杯`, { sugaryDrink: true });
}
register("大杯鲜萃咖啡|小杯鲜萃咖啡|浓缩咖啡", { coffee: true, sugaryDrink: "unknown" });
register("100%苹果汁|热朱古力|麦旋酷阳光橙", { sugaryDrink: true });

export function nameAttributes(name) {
  const known = profiles.get(normalizeName(name));
  if (known) return { ...known };
  const result = Object.fromEntries(attributeKeys.map(key => [key, "unknown"]));
  if (/麦辣|香辣|麻辣/.test(name)) result.spicy = true;
  if (/牛肉|牛堡/.test(name)) result.beef = true;
  if (/鱼排|鳕鱼|麦香鱼/.test(name)) result.fish = true;
  if (/咖啡|拿铁|美式|卡布奇诺/.test(name)) result.coffee = true;
  return result;
}

function fits(name, preference) {
  const attrs = nameAttributes(name);
  return preference.exclusions.every(ex => attrs[exclusions[ex]] === false);
}

export function categoryFor(name, hasRounds = false) {
  if (hasRounds || /套餐|组合|随心配|件套/.test(name)) return "combo";
  if (/汉堡|麦满分|堡|粥|营养卷|^巨无霸$|^麦香鸡$|^麦香鱼$/.test(name)) return "main";
  if (/冰淇淋|麦旋风|新地|甜筒|派$|蛋糕/.test(name)) return "dessert";
  if (/薯|麦乐鸡|鸡翅|鸡排|玉米|苹果片|油条/.test(name)) return "snack";
  return "drink";
}

function number(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new LiveError("CONFIGURATION", `${label}不完整，这份餐点暂时无法推荐。`);
  return value;
}

export function configureMeal(detail, preference, nutrition) {
  if (!detail?.code || !detail?.name)
    throw new LiveError("CONFIGURATION", "餐品资料不完整。");
  const components = [];
  const item = { productCode: String(detail.code), quantity: 1 };
  if (detail.modification) item.modification = defaultModification(detail.modification);
  if (Array.isArray(detail.rounds) && detail.rounds.length) {
    item.roundList = detail.rounds.map(round => {
      if (round.id == null || !Array.isArray(round.choices))
        throw new LiveError("CONFIGURATION", "套餐选项不完整。");
      let selected = round.choices.filter(c => number(c.quantity ?? 0, "餐品数量") > 0)
        .map(c => ({ ...c }));
      const min = number(round.minQuantity, "选项下限");
      const max = round.maxQuantity;
      if (!Number.isInteger(max)) throw new LiveError("CONFIGURATION", "选项上限不完整。");
      let total = selected.reduce((n, c) => n + c.quantity, 0);
      if (total < min) {
        const choice = round.choices.find(c => fits(c.name, preference) && (c.maxQuantity < 0 || c.maxQuantity >= min));
        if (!choice) throw new LiveError("NO_MATCH", "这份套餐没有符合口味的选项。");
        selected = [{ ...choice, quantity: min }]; total = min;
      }
      if (max >= 0 && total > max)
        throw new LiveError("CONFIGURATION", "套餐数量超出可选范围。");
      selected = selected.map(c => {
        const alternatives = round.choices.filter(x => fits(x.name, preference)
          && (x.maxQuantity < 0 || x.maxQuantity >= c.quantity));
        const currentFits = fits(c.name, preference);
        if (preference.mood === "balanced") {
          // Choose by matched, per-serving nutrition only; final total must also pass below.
          alternatives.sort((a, b) => (nutrition.get(normalizeName(a.name))?.kcal ?? Infinity)
            - (nutrition.get(normalizeName(b.name))?.kcal ?? Infinity));
          const light = alternatives.find(x => {
            const n = nutrition.get(normalizeName(x.name));
            return n && !n.ambiguous;
          });
          if (light) return { ...light, quantity: c.quantity };
        }
        if (currentFits) return c;
        if (!alternatives.length) throw new LiveError("NO_MATCH", "餐品资料不足或不符合口味。");
        return { ...alternatives[0], quantity: c.quantity };
      });
      const merged = new Map();
      for (const choice of selected) {
        const previous = merged.get(String(choice.code));
        if (previous) previous.quantity += choice.quantity;
        else merged.set(String(choice.code), { ...choice });
      }
      selected = [...merged.values()];
      return {
        round: String(round.id),
        comboItemList: selected.map(c => {
          if (!c.code || (c.maxQuantity >= 0 && c.quantity > c.maxQuantity))
            throw new LiveError("CONFIGURATION", "套餐子项数量不正确。");
          components.push({ name: c.name, quantity: c.quantity });
          const modification = defaultModification(c.modification);
          return { code: String(c.code), quantity: c.quantity, ...(modification ? { modification } : {}) };
        }),
      };
    });
  } else {
    components.push({ name: detail.name, quantity: 1 });
  }
  if (!components.length || !components.every(c => fits(c.name, preference)))
    throw new LiveError("NO_MATCH", "这份餐点不符合所选口味，或资料不足。");
  const attrs = Object.fromEntries(attributeKeys.map(key => {
    const values = components.map(c => nameAttributes(c.name)[key]);
    return [key, values.includes(true) ? true : values.includes("unknown") ? "unknown" : false];
  }));
  let kcal = 0, protein = 0, complete = true;
  for (const c of components) {
    const n = nutrition.get(normalizeName(c.name));
    if (!n || n.ambiguous) { complete = false; continue; }
    kcal += n.kcal * c.quantity; protein += n.protein * c.quantity;
  }
  const category = categoryFor(detail.name, Boolean(item.roundList));
  if (preference.mood === "balanced"
    && (!complete || kcal > 650 || protein < 15 || !["combo", "main"].includes(category)))
    throw new LiveError("NO_MATCH", "暂未找到营养资料完整、符合清爽搭配条件的餐点。");
  if (preference.mood === "treat" && !["combo", "main"].includes(category))
    throw new LiveError("NO_MATCH", "本次选择主餐。");
  if (preference.mood === "snack" && !["snack", "dessert"].includes(category))
    throw new LiveError("NO_MATCH", "本次选择小食或甜品。");
  return { item, components, attrs, category, nutrition: complete ? { kcal, protein } : null };
}

export function menuCodes(menu, preference) {
  if (!menu?.meals || typeof menu.meals !== "object")
    throw new LiveError("MENU", "没有读到门店菜单，请稍后重试。");
  return Object.entries(menu.meals).filter(([, meal]) => meal && !meal.canWithOrder
    && typeof meal.name === "string" && !/会员|权益|兑换|优惠券|调料|餐具|玩具|礼品/.test(meal.name))
    .filter(([, meal]) => preference.mood === "snack"
      ? ["snack", "dessert"].includes(categoryFor(meal.name))
      : ["combo", "main"].includes(categoryFor(meal.name)))
    .sort((a, b) => {
      const score = ([, meal]) => /套餐|组合|随心配|件套/.test(meal.name) ? 0 : 1;
      return score(a) - score(b);
    }).map(([code]) => code);
}
