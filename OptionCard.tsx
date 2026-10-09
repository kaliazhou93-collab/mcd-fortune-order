import type { ReactNode } from "react";

interface OptionCardProps {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  disabled?: boolean;
}

/** 带边框大卡片的语义化选项；选中用勾选标记 + 边框，不仅靠颜色。 */
export function OptionCard({
  type,
  name,
  value,
  checked,
  onChange,
  children,
  disabled,
}: OptionCardProps) {
  return (
    <label className="option-card" data-selected={checked} data-disabled={disabled}>
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="check" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}
