/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Vite + Vitest 配置。
// 说明：Playwright 的 e2e 测试独立于 Vitest，使用 playwright.config.ts。
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // e2e 目录由 Playwright 运行，Vitest 不收集。
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
  },
});
