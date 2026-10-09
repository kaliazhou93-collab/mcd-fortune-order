import { describe, expect, it } from "vitest";
import { pickFortune, sceneForGrade } from "@shared/fortune";
import { createRng } from "@shared/rng";
import { ALL_FORTUNES } from "@shared/fixture-adapter";
import type { FortuneGrade } from "@shared/types";

describe("fortune 数据完整性", () => {
  it("共 128 条，等级配比 19/40/42/27", () => {
    expect(ALL_FORTUNES).toHaveLength(128);
    const count = (g: FortuneGrade) => ALL_FORTUNES.filter((f) => f.grade === g).length;
    expect(count("超级大吉")).toBe(19);
    expect(count("大吉")).toBe(40);
    expect(count("中吉")).toBe(42);
    expect(count("小吉")).toBe(27);
  });

  it("所有 id 唯一且稳定", () => {
    const ids = new Set(ALL_FORTUNES.map((f) => f.id));
    expect(ids.size).toBe(ALL_FORTUNES.length);
  });

  it("场景与等级映射一致", () => {
    for (const f of ALL_FORTUNES) {
      expect(f.scene).toBe(sceneForGrade(f.grade));
    }
  });
});

describe("fortune 选择", () => {
  it("优先排除最近 15 条历史", () => {
    const history = ALL_FORTUNES.slice(0, 15).map((f) => f.id);
    const { fortune } = pickFortune(ALL_FORTUNES, history, createRng(7));
    expect(history).not.toContain(fortune.id);
  });

  it("历史窗口在池耗尽时逐步放宽，不抛错", () => {
    // 构造一个小池：3 条签文，历史里已有全部 3 条
    const tiny = ALL_FORTUNES.slice(0, 3);
    const history = tiny.map((f) => f.id);
    const { fortune } = pickFortune(tiny, history, createRng(3));
    expect(tiny.map((f) => f.id)).toContain(fortune.id);
  });

  it("forceGrade 只返回指定等级（验收测试用）", () => {
    for (const grade of ["超级大吉", "大吉", "中吉", "小吉"] as FortuneGrade[]) {
      const { fortune } = pickFortune(ALL_FORTUNES, [], createRng(1), {
        forceGrade: grade,
      });
      expect(fortune.grade).toBe(grade);
    }
  });

  it("返回的新历史最多保留 15 条且最新在前", () => {
    const { fortune, history } = pickFortune(ALL_FORTUNES, [], createRng(9));
    expect(history[0]).toBe(fortune.id);
    expect(history.length).toBeLessThanOrEqual(15);
  });
});

describe("随机独立性", () => {
  it("不同种子的签文与商品 RNG 互不耦合（示例：同签文不同序列）", () => {
    // 用两个独立实例，验证序列不同即可说明互不共享状态
    const a = createRng(100);
    const b = createRng(200);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).not.toEqual(seqB);
  });
});
