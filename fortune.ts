import type { Fortune, FortuneGrade } from "./types";
import type { Rng } from "./rng";

// 签文选择：从排除最近 15 条后的签文均匀选取；候选耗尽才逐步放宽历史。
// 诚实说明：这不是「每 15 次绝对无重复」的保证，仅是一个保守的近期去重策略。

const HISTORY_WINDOW = 15;

export interface FortunePickResult {
  fortune: Fortune;
  /** 新的历史（最近在前），供下一次调用传入。 */
  history: string[];
}

export interface PickOptions {
  /** 强制等级，用于验收测试；正式用户不能用它换取优惠。 */
  forceGrade?: FortuneGrade;
}

export function pickFortune(
  all: readonly Fortune[],
  history: readonly string[],
  rng: Rng,
  options: PickOptions = {},
): FortunePickResult {
  if (all.length === 0) {
    throw new RangeError("签文池为空");
  }

  const pool = options.forceGrade
    ? all.filter((f) => f.grade === options.forceGrade)
    : all.slice();

  if (pool.length === 0) {
    throw new RangeError(`没有等级为 ${options.forceGrade} 的签文`);
  }

  // 从最近 window 条开始逐步放宽，直到有可选项。
  let window = Math.min(HISTORY_WINDOW, history.length);
  let candidates: Fortune[] = [];
  while (window >= 0) {
    const recent = new Set(history.slice(0, window));
    candidates = pool.filter((f) => !recent.has(f.id));
    if (candidates.length > 0) break;
    window -= 1;
  }
  // 极端情况下（池极小且全在历史里）直接用整个 pool。
  if (candidates.length === 0) {
    candidates = pool.slice();
  }

  const fortune = rng.pick(candidates);
  const nextHistory = [fortune.id, ...history].slice(0, HISTORY_WINDOW);
  return { fortune, history: nextHistory };
}

/** 场景图映射：庆祝（大吉/超级大吉）、普通（中吉）、安慰（小吉）。 */
export function sceneForGrade(grade: FortuneGrade): Fortune["scene"] {
  switch (grade) {
    case "超级大吉":
    case "大吉":
      return "celebration";
    case "中吉":
      return "welcome";
    case "小吉":
      return "comfort";
  }
}
