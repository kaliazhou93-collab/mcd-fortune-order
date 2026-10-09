import type {
  Candidate,
  Exclusion,
  FoodAttribute,
  Mood,
  Preference,
  Tristate,
} from "./types";
import type { Rng } from "./rng";

// 推荐规则：先硬过滤，再匹配心情，再随机。
// 关键保守规则：硬排除遇到 unknown 不能当作已满足，直接排除该候选。

/** 排除项 → 需要检查为 false 的属性键。 */
const EXCLUSION_ATTRIBUTE: Record<Exclusion, string | null> = {
  "no-spicy": "spicy",
  "no-beef": "beef",
  "no-fish": "fish",
  "no-coffee": "coffee",
  // 注意：区分「含糖饮料」与食物天然含糖；这里只看饮料含糖属性。
  "no-sugary-drink": "sugaryDrink",
  anything: null,
};

function attrValue(attributes: readonly FoodAttribute[], key: string): Tristate {
  const found = attributes.find((a) => a.key === key);
  return found ? found.value : "unknown";
}

export interface FilterResult {
  passed: Candidate[];
  /** 因 unknown 被保守排除的候选，便于「资料不够，换个条件看看」提示。 */
  droppedForUnknown: Candidate[];
}

/**
 * 应用硬排除。对每个激活的排除项：
 * - 属性为 true  → 该候选含此项，排除；
 * - 属性为 unknown → 资料不足，保守排除（不得当作已满足）；
 * - 属性为 false → 通过该项检查。
 */
export function applyExclusions(
  candidates: readonly Candidate[],
  exclusions: readonly Exclusion[],
): FilterResult {
  const active = exclusions.filter((e) => e !== "anything");
  if (active.length === 0) {
    return { passed: candidates.slice(), droppedForUnknown: [] };
  }

  const passed: Candidate[] = [];
  const droppedForUnknown: Candidate[] = [];

  for (const candidate of candidates) {
    let ok = true;
    let unknownBlocked = false;
    for (const exclusion of active) {
      const key = EXCLUSION_ATTRIBUTE[exclusion];
      if (!key) continue;
      const value = attrValue(candidate.attributes, key);
      if (value === true) {
        ok = false;
        break;
      }
      if (value === "unknown") {
        ok = false;
        unknownBlocked = true;
        break;
      }
    }
    if (ok) {
      passed.push(candidate);
    } else if (unknownBlocked) {
      droppedForUnknown.push(candidate);
    }
  }

  return { passed, droppedForUnknown };
}

/** 心情匹配：按类别约束候选集合（不以价格/热量/份量为准入条件）。 */
export function matchMood(candidates: readonly Candidate[], mood: Mood): Candidate[] {
  switch (mood) {
    case "treat":
      // 放纵：主餐/套餐。
      return candidates.filter(
        (c) => c.product.category === "combo" || c.product.category === "main",
      );
    case "balanced":
      // 均衡：需要可核实营养的组成；此处要求候选自身声明 balanced。
      return candidates.filter((c) => c.mood === "balanced");
    case "snack":
      // 小确幸：单份小食/甜品。
      return candidates.filter(
        (c) => c.product.category === "snack" || c.product.category === "dessert",
      );
  }
}

export interface PrepareResult {
  /** 最终可用候选（已过滤、已匹配心情）。 */
  pool: Candidate[];
  droppedForUnknown: Candidate[];
}

/** 组合硬过滤与心情匹配，产出候选池（不在此处随机，保持与签文随机独立）。 */
export function preparePool(
  candidates: readonly Candidate[],
  preference: Preference,
): PrepareResult {
  const { passed, droppedForUnknown } = applyExclusions(candidates, preference.exclusions);
  const pool = matchMood(passed, preference.mood);
  return { pool, droppedForUnknown };
}

/**
 * 从候选池抽样一个。换口味时 avoidProductCode 优先避开上一主餐，
 * 不足时返回仅剩的那一份（由调用方说明「当前只有这一份符合条件」）。
 */
export function sampleCandidate(
  pool: readonly Candidate[],
  rng: Rng,
  avoidProductCode?: string,
): Candidate | null {
  if (pool.length === 0) return null;
  if (avoidProductCode && pool.length > 1) {
    const alt = pool.filter((c) => c.product.code !== avoidProductCode);
    if (alt.length > 0) {
      return rng.pick(alt);
    }
  }
  return rng.pick(pool);
}
