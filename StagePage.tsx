import { useEffect, useRef, useState } from "react";
import type { AppStore } from "../state/useAppStore";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const TOTAL_MS = 2500;

/**
 * 抽签舞台：数据就绪后播放约 2.5 秒本地动画。
 * 减少动态效果时直接短淡入；动画期间只处理一次点击（跳过）。
 */
export function StagePage({ store }: { store: AppStore }) {
  const reduced = usePrefersReducedMotion();
  const [done, setDone] = useState(false);
  const advanced = useRef(false);

  useEffect(() => {
    const duration = reduced ? 200 : TOTAL_MS;
    const timer = window.setTimeout(() => setDone(true), duration);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (done && !advanced.current) {
      advanced.current = true;
      store.toResult();
    }
  }, [done, store]);

  const skip = () => {
    if (!advanced.current) {
      setDone(true);
    }
  };

  return (
    <div className="stage">
      <span className="stage-tag">这份惊喜，正在路上</span>
      <img
        className={`stage-fries${reduced ? "" : " shaking"}`}
        src={`${import.meta.env.BASE_URL}art/fries.png`}
        alt="薯条签筒正在轻轻摇动"
        width={240}
        height={282}
      />
      <div className="stage-shadow" />
      <button type="button" className="btn btn-text" onClick={skip} data-testid="skip-stage">
        跳过动画
      </button>
    </div>
  );
}
