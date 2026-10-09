import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAppStore } from "@/state/useAppStore";
import { createFixtureAdapter } from "@shared/fixture-adapter";

describe("useAppStore — 行为", () => {
  it("摇签前 canDraw 为 false，选心情后为 true", () => {
    const adapter = createFixtureAdapter({ latencyMs: 0 });
    const { result } = renderHook(() => useAppStore(adapter, { seed: "s" }));
    expect(result.current.canDraw).toBe(false);
    act(() => result.current.setMood("treat"));
    expect(result.current.canDraw).toBe(true);
  });

  it("换口味不改变购物车清单", async () => {
    const adapter = createFixtureAdapter({ latencyMs: 0 });
    const { result } = renderHook(() =>
      useAppStore(adapter, { seed: "s", forceGrade: "大吉" }),
    );

    act(() => result.current.setMood("treat"));
    await act(async () => {
      await result.current.draw();
    });
    act(() => result.current.toResult());
    act(() => result.current.confirmAdd());
    await waitFor(() => expect(result.current.cart.lines.length).toBe(1));

    const before = result.current.cart.version;
    await act(async () => {
      await result.current.reroll();
    });
    // reroll 不动购物车
    expect(result.current.cart.version).toBe(before);
    expect(result.current.cart.lines.length).toBe(1);
  });

  it("「都可以」与其它排除项互斥", () => {
    const adapter = createFixtureAdapter({ latencyMs: 0 });
    const { result } = renderHook(() => useAppStore(adapter, { seed: "s" }));
    act(() => result.current.toggleExclusion("no-beef"));
    act(() => result.current.toggleExclusion("anything"));
    expect(result.current.preference.exclusions).toEqual(["anything"]);
    // 再选具体项会清掉 anything
    act(() => result.current.toggleExclusion("no-fish"));
    expect(result.current.preference.exclusions).toEqual(["no-fish"]);
  });

  it("候选为空时停在首页并给出错误说明", async () => {
    // 用 stub 适配器返回空候选，稳定触发 no-candidates 路径。
    const emptyAdapter = {
      kind: "fixture" as const,
      getCandidates: async () => [],
      getFortunes: createFixtureAdapter({ latencyMs: 0 }).getFortunes,
    };
    const { result } = renderHook(() => useAppStore(emptyAdapter, { seed: "s" }));
    act(() => result.current.setMood("treat"));
    await act(async () => {
      await result.current.draw();
    });
    expect(result.current.screen).toBe("home");
    expect(result.current.prepareError?.kind).toBe("no-candidates");
  });
});
