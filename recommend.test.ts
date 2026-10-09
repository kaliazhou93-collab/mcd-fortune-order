import { describe, expect, it } from "vitest";
import {
  applyExclusions,
  matchMood,
  preparePool,
  sampleCandidate,
} from "@shared/recommend";
import { createRng } from "@shared/rng";
import { DEMO_CANDIDATES } from "@shared/demo-data";
import type { Candidate, Preference } from "@shared/types";

// Synthetic test-only candidate, never shown as a real menu item.
const UNKNOWN_CANDIDATE: Candidate = {
  ...DEMO_CANDIDATES[0],
  id: "synthetic-unknown-spice",
  attributes: [{ key: "spicy", value: "unknown", source: "synthetic-test", checkedAt: "" }],
};

describe("recommend — 硬排除", () => {
  it("no-spicy 遇到 unknown 辣度时保守排除，不当作已满足", () => {
    const { passed, droppedForUnknown } = applyExclusions([...DEMO_CANDIDATES, UNKNOWN_CANDIDATE], ["no-spicy"]);
    expect(passed).not.toContain(UNKNOWN_CANDIDATE);
    expect(droppedForUnknown).toContain(UNKNOWN_CANDIDATE);
  });

  it("no-beef 排除巨无霸和成分尚未确认的汉堡包套餐", () => {
    const { passed } = applyExclusions(DEMO_CANDIDATES, ["no-beef"]);
    const codes = passed.map((c) => c.id);
    expect(codes).not.toContain("cand-bigmac-cola");
    expect(codes).not.toContain("cand-happy-chicken");
    expect(codes).toContain("cand-strawberry-mcflurry");
  });

  it("no-sugary-drink 不排除天然含糖的甜品（甜品非饮料）", () => {
    const { passed } = applyExclusions(DEMO_CANDIDATES, ["no-sugary-drink"]);
    expect(passed.map((c) => c.id)).toContain("cand-strawberry-mcflurry");
    // 但含糖可乐套餐被排除
    expect(passed.map((c) => c.id)).not.toContain("cand-bigmac-cola");
  });

  it("anything 不触发任何排除", () => {
    const { passed } = applyExclusions(DEMO_CANDIDATES, ["anything"]);
    expect(passed).toHaveLength(DEMO_CANDIDATES.length);
  });
});

describe("recommend — 心情匹配", () => {
  it("snack 只保留小食/甜品", () => {
    const pool = matchMood(DEMO_CANDIDATES, "snack");
    expect(pool.every((c) => ["snack", "dessert"].includes(c.product.category))).toBe(true);
    expect(pool.map((c) => c.id)).toContain("cand-strawberry-mcflurry");
  });

  it("balanced 只保留声明 balanced 的候选", () => {
    const pool = matchMood(DEMO_CANDIDATES, "balanced");
    expect(pool.every((c) => c.mood === "balanced")).toBe(true);
  });
});

describe("recommend — 组合与采样", () => {
  it("preparePool 对 no-spicy + treat 返回不含 unknown 辣度的主餐", () => {
    const pref: Preference = { mood: "treat", exclusions: ["no-spicy"], revision: 1 };
    const { pool } = preparePool([...DEMO_CANDIDATES, UNKNOWN_CANDIDATE], pref);
    expect(pool.map((c) => c.id)).not.toContain(UNKNOWN_CANDIDATE.id);
    expect(pool.map((c) => c.id)).toContain("cand-bigmac-cola");
  });

  it("相同种子的 RNG 产生相同采样（可复现）", () => {
    const pool = matchMood(DEMO_CANDIDATES, "treat");
    const a = sampleCandidate(pool, createRng(42));
    const b = sampleCandidate(pool, createRng(42));
    expect(a?.id).toBe(b?.id);
  });

  it("换口味优先避开当前主餐编码", () => {
    const pool = matchMood(DEMO_CANDIDATES, "treat");
    // 历史样例里包含巨无霸与另一份汉堡包套餐。
    const avoid = "9900005466"; // 巨无霸
    for (let seed = 0; seed < 20; seed += 1) {
      const picked = sampleCandidate(pool, createRng(seed), avoid);
      expect(picked?.product.code).not.toBe(avoid);
    }
  });

  it("只剩一份符合条件时仍返回那一份（不假装另一份）", () => {
    const single = [DEMO_CANDIDATES[0]];
    const picked = sampleCandidate(single, createRng(1), single[0].product.code);
    expect(picked?.id).toBe(single[0].id);
  });

  it("空池返回 null", () => {
    expect(sampleCandidate([], createRng(1))).toBeNull();
  });
});
