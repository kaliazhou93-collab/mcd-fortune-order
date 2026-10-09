import { useState } from "react";

interface ProductThumbProps {
  src?: string;
  alt: string;
}

/** 商品缩略图；加载失败使用中性餐具图标，不换成不对应的汉堡图。 */
export function ProductThumb({ src, alt }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="product-thumb thumb-fallback" role="img" aria-label={alt}>
        🍽️
      </span>
    );
  }
  return (
    <img
      className="product-thumb"
      src={src}
      alt={alt}
      width={72}
      height={72}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
