import { test, expect } from "@playwright/test";

// 主流程与宽度检查。
// 运行方式（由 Codex 实际执行，Kiro 不声称已运行）：
//   npm install
//   npm run build
//   npm run test:e2e
// playwright.config.ts 为每个验收宽度（360/390/768/1024/1440）生成一个 project。

test.describe("今天麦什么 · 演示主流程", () => {
  test("首页加载并显示演示标识与标题", async ({ page }) => {
    await page.goto("/?seed=e2e&grade=大吉");
    await expect(page.getByRole("heading", { name: "今天麦什么", level: 1 })).toBeVisible();
    await expect(page.getByText("独立创意项目")).toBeVisible();
  });

  test("无横向溢出", async ({ page }) => {
    await page.goto("/?seed=e2e");
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(overflow).toBe(false);
  });

  test("选心情 → 摇签 → 结果 → 加购 → 购物车 → 确认（模拟）", async ({ page }) => {
    await page.goto("/?seed=e2e&grade=大吉");

    // 摇签按钮初始禁用
    await expect(page.getByTestId("draw-button")).toBeDisabled();

    // 选放纵餐
    await page.getByText("🍟 今日放纵餐").click();
    await expect(page.getByTestId("draw-button")).toBeEnabled();

    await page.getByTestId("draw-button").click();

    // 跳过动画加速
    await page.getByTestId("skip-stage").click();

    // 结果页
    await expect(page.getByTestId("eat-this")).toBeVisible();
    await expect(page.getByText("大吉")).toBeVisible();

    // 加购 → 购物车
    await page.getByTestId("eat-this").click();
    await expect(page.getByTestId("to-confirm")).toBeVisible();

    // 去确认 → 模拟下单
    await page.getByTestId("to-confirm").click();
    await page.getByTestId("place-order").click();
    await expect(page.getByText("模拟订单已创建")).toBeVisible();
  });

  test("换口味保留在结果页且不进入购物车", async ({ page }) => {
    await page.goto("/?seed=e2e&grade=中吉");
    await page.getByText("🍟 今日放纵餐").click();
    await page.getByTestId("draw-button").click();
    await page.getByTestId("skip-stage").click();
    await expect(page.getByTestId("reroll")).toBeVisible();

    await page.getByTestId("reroll").click();
    // 换口味后回到舞台再到结果，购物车仍为空
    await page.getByTestId("skip-stage").click();
    await expect(page.getByTestId("cart-pill")).toHaveText(/0/);
  });
});
