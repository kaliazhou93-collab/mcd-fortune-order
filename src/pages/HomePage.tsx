import type { AppStore } from "../state/useAppStore";
import type { Exclusion, Mood } from "@shared/types";
import { OptionCard } from "../components/OptionCard";

const MOODS: { value: Mood; label: string; hint: string }[] = [
  { value: "treat", label: "🍟 今日放纵餐", hint: "来点喜欢的口感，自己决定份量" },
  { value: "balanced", label: "🌽 清爽均衡餐", hint: "按可核实的餐品与营养资料比较" },
  { value: "snack", label: "🍦 来点小确幸", hint: "给自己安排一份小食或甜品" },
];

const EXCLUSIONS: { value: Exclusion; label: string }[] = [
  { value: "no-spicy", label: "不吃辣" },
  { value: "no-beef", label: "不想吃牛肉" },
  { value: "no-fish", label: "不想吃鱼" },
  { value: "no-coffee", label: "不想喝咖啡" },
  { value: "no-sugary-drink", label: "不想喝含糖饮料" },
  { value: "anything", label: "都可以" },
];

export function HomePage({ store }: { store: AppStore }) {
  const { preference, context, prepareError } = store;

  return (
    <div className="two-col">
      <section aria-hidden="false">
        <img
          className="scene-img ratio-welcome"
          src={`${import.meta.env.BASE_URL}art/shop-welcome.png`}
          alt="普通店铺场景：麦麦小舞台欢迎你"
          width={1024}
          height={709}
        />
      </section>

      <section className="read-col">
        <h1>今天麦什么</h1>
        <p>摇一签，让这一餐有点小惊喜。</p>

        {prepareError && (
          <div
            className="notice"
            data-tone={prepareError.kind === "pricing" ? "error" : "info"}
            role="status"
          >
            {prepareError.message}
          </div>
        )}

        <fieldset className="field">
          <legend className="field-label">今天，怎么和麦麦碰头？</legend>
          <div className="option-grid">
            <OptionCard
              type="radio"
              name="mode-be"
              value="eat-in"
              checked={context.beType === 1}
              onChange={() => undefined}
            >
              出门走走，进店接麦麦
            </OptionCard>
            <OptionCard
              type="radio"
              name="mode-be"
              value="delivery"
              checked={false}
              onChange={() => undefined}
              disabled
            >
              原地躺好，等麦麦上门（开发中）
            </OptionCard>
          </div>
          <p className="disabled-note">
            外送尚未接通，首个里程碑先跑通到店；不会静默按到店计价。
          </p>
        </fieldset>

        <div className="field">
          <div className="field-label">门店</div>
          <div className="card" style={{ padding: "12px 16px" }}>
            <strong>{context.storeName}</strong>
            <div className="price-meta">{context.storeAddress}</div>
          </div>
          <p className="disabled-note">
            演示模式使用示例门店；真实模式需在本地服务配置后显式选择。
          </p>
        </div>

        <fieldset className="field">
          <legend className="field-label">今天想吃哪一款心情？</legend>
          <div className="option-grid">
            {MOODS.map((m) => (
              <OptionCard
                key={m.value}
                type="radio"
                name="mood"
                value={m.value}
                checked={store.canDraw && preference.mood === m.value}
                onChange={() => store.setMood(m.value)}
              >
                <strong>{m.label}</strong>
                <div className="price-meta">{m.hint}</div>
              </OptionCard>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">今天有什么想跳过的？</legend>
          <div className="option-grid">
            {EXCLUSIONS.map((e) => (
              <OptionCard
                key={e.value}
                type="checkbox"
                name="exclusion"
                value={e.value}
                checked={preference.exclusions.includes(e.value)}
                onChange={() => store.toggleExclusion(e.value)}
              >
                {e.label}
              </OptionCard>
            ))}
          </div>
          <p className="disabled-note">
            前五项可多选；「都可以」与其它互斥。「不喝含糖饮料」不等于拒绝所有含糖食物。
          </p>
        </fieldset>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void store.draw()}
          disabled={!store.canDraw}
          data-testid="draw-button"
        >
          帮我摇一份
        </button>
        {!store.canDraw && (
          <p className="disabled-note" role="status">
            先选一个今天的心情，就能开始摇签。
          </p>
        )}
      </section>
    </div>
  );
}
