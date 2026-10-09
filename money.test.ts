import { describe, expect, it } from "vitest";
import {
  formatFen,
  realDiscountToFen,
  sumFen,
  yuanToFen,
} from "@shared/money";

describe("money", () => {
  it("yuanToFen 把元字符串转为整数分，避免浮点误差", () => {
    expect(yuanToFen("37.50")).toBe(3750);
    expect(yuanToFen("9.90")).toBe(990);
    expect(yuanToFen(28)).toBe(2800);
    // 典型浮点陷阱 0.1+0.2
    expect(yuanToFen("0.30")).toBe(30);
  });

  it("yuanToFen 拒绝负数与非数字", () => {
    expect(() => yuanToFen("-1")).toThrow();
    expect(() => yuanToFen("abc")).toThrow();
    expect(() => yuanToFen(Number.NaN)).toThrow();
  });

  it("formatFen 以分转元展示两位小数", () => {
    expect(formatFen(3750)).toBe("¥37.50");
    expect(formatFen(0)).toBe("¥0.00");
    expect(formatFen(990)).toBe("¥9.90");
  });

  it("formatFen 拒绝非整数分与负数", () => {
    expect(() => formatFen(37.5)).toThrow();
    expect(() => formatFen(-100)).toThrow();
  });

  it("realDiscountToFen 把元单位折扣转分，缺失按 0", () => {
    expect(realDiscountToFen("4.10")).toBe(410);
    expect(realDiscountToFen(null)).toBe(0);
    expect(realDiscountToFen(undefined)).toBe(0);
    expect(realDiscountToFen("")).toBe(0);
  });

  it("sumFen 要求整数分", () => {
    expect(sumFen([3750, 990])).toBe(4740);
    expect(() => sumFen([1.5])).toThrow();
  });
});
