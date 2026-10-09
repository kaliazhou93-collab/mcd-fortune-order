import type { AppStore } from "../state/useAppStore";

/** 查询状态页：「看看这家店今天有什么」，可取消返回，不丢偏好。 */
export function PreparingPage({ store }: { store: AppStore }) {
  return (
    <div className="stage" role="status" aria-live="polite">
      <span className="stage-tag">这份惊喜，正在路上</span>
      <div className="stage-shadow" />
      <p>看看这家店今天有什么…</p>
      <button type="button" className="btn btn-secondary" onClick={store.goHome}>
        取消，返回条件
      </button>
    </div>
  );
}
