// 金额工具：内部一律整数分；仅在展示边界转元。
// 对应 ACCEPTANCE B：quote.price 分转元、realDiscount 元处理，零/缺失/负数需明确校验。

/** 将「元」字符串/数字安全转为整数分。拒绝 NaN/负数/异常。 */
export function yuanToFen(value: string | number): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(n)) {
    throw new RangeError(`金额无法解析为数字: ${String(value)}`);
  }
  if (n < 0) {
    throw new RangeError(`金额不可为负: ${String(value)}`);
  }
  // 避免浮点误差：四舍五入到分。
  return Math.round(n * 100);
}

/** 将整数分转为「¥xx.xx」展示串。 */
export function formatFen(fen: number): string {
  if (!Number.isInteger(fen)) {
    throw new RangeError(`分必须为整数: ${fen}`);
  }
  if (fen < 0) {
    throw new RangeError(`金额不可为负: ${fen}`);
  }
  const yuan = (fen / 100).toFixed(2);
  return `¥${yuan}`;
}

/** 读取「realDiscount」字段：MCP 说明其单位为元，这里转分。缺失按 0。 */
export function realDiscountToFen(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return yuanToFen(value);
}

/** 累加行金额，保持整数分。 */
export function sumFen(values: number[]): number {
  return values.reduce((acc, v) => {
    if (!Number.isInteger(v)) {
      throw new RangeError(`分必须为整数: ${v}`);
    }
    return acc + v;
  }, 0);
}
