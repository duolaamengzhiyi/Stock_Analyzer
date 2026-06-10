/**
 * 涨跌幅显示组件（FR-043）：A 股语义——涨红跌绿。
 * 文字 + 视觉双编码（前缀箭头 +/-，避免单一颜色依赖；FR-055）。
 */
import { cn } from "@/lib/utils/cn";

interface ChangePercentProps {
  /** 百分比数值，如 2.34（表示 +2.34%）；null/undefined 显示占位符 */
  value: number | null | undefined;
  /** 小数位数，默认 2 */
  digits?: number;
  /** 是否显示 + 号 */
  showSign?: boolean;
  className?: string;
}

export function ChangePercent({
  value,
  digits = 2,
  showSign = true,
  className,
}: ChangePercentProps) {
  if (value == null || Number.isNaN(value)) {
    return (
      <span className={cn("text-muted-foreground tabular-nums", className)}>
        —
      </span>
    );
  }

  const isUp = value > 0;
  const isDown = value < 0;
  const sign = showSign ? (isUp ? "+" : isDown ? "−" : "") : "";
  const arrow = isUp ? "▲" : isDown ? "▼" : "·";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono tabular-nums",
        isUp && "text-bull",
        isDown && "text-bear",
        !isUp && !isDown && "text-flat",
        className,
      )}
      aria-label={`涨跌幅 ${sign}${Math.abs(value).toFixed(digits)}%`}
    >
      <span aria-hidden>{arrow}</span>
      <span>
        {sign}
        {Math.abs(value).toFixed(digits)}%
      </span>
    </span>
  );
}
