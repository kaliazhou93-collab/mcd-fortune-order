import { defineConfig, devices } from "@playwright/test";

// Playwright 主流程与宽度检查。
// 注意：命令由 Codex 实际运行；此处仅提供可复现配置，不代表已通过。
// 运行前请先 `npm run build && npm run preview`，或让 webServer 自动拉起 dev。
const WIDTHS = [360, 390, 768, 1024, 1440];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  // 为每个验收宽度生成一个项目，便于逐宽度检查无横向溢出。
  projects: WIDTHS.map((width) => ({
    name: `w${width}`,
    use: {
      ...devices["Desktop Chrome"],
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      viewport: { width, height: 900 },
    },
  })),
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
