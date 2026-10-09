import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useAppStore } from "@/state/useAppStore";
import { HomePage } from "@/pages/HomePage";
import { StagePage } from "@/pages/StagePage";
import { ResultPage } from "@/pages/ResultPage";
import { CartPage } from "@/pages/CartPage";
import { createFixtureAdapter } from "@shared/fixture-adapter";
import type { AppStore } from "@/state/useAppStore";

// 测试宿主：按 screen 渲染对应页面，使用 0 延迟 fixture。
function Harness() {
  const adapter = createFixtureAdapter({ latencyMs: 0 });
  const store: AppStore = useAppStore(adapter, { seed: "test", forceGrade: "大吉" });
  switch (store.screen) {
    case "home":
      return <HomePage store={store} />;
    case "stage":
      return <StagePage store={store} />;
    case "result":
      return <ResultPage store={store} />;
    case "cart":
      return <CartPage store={store} />;
    case "preparing":
      return <div>preparing</div>;
    default:
      return <div>{store.screen}</div>;
  }
}

describe("演示主流程（组件级）", () => {
  it("选心情 → 摇签 → 跳过动画 → 结果 → 就吃这份 → 购物车", async () => {
    render(<Harness />);

    expect(screen.getByTestId("draw-button")).toBeDisabled();

    fireEvent.click(screen.getByText("🍟 今日放纵餐"));
    expect(screen.getByTestId("draw-button")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("draw-button"));

    // 舞台出现后点击跳过，直接推进到结果页。
    await waitFor(() => expect(screen.getByTestId("skip-stage")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("skip-stage"));

    await waitFor(() => expect(screen.getByText("大吉")).toBeInTheDocument());
    expect(screen.getByTestId("eat-this")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("eat-this"));
    await waitFor(() => expect(screen.getByText("待购清单")).toBeInTheDocument());
    expect(screen.getByTestId("to-confirm")).toBeInTheDocument();
  });
});
