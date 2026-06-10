/**
 * 股票徽标：代码 + 名称 + 市场标识。
 * 涨红跌绿语义色由内部组件按需使用；此组件仅做静态信息呈现。
 */
import { cn } from "@/lib/utils/cn";

interface StockBadgeProps {
  code: string;
  name?: string | null;
  market?: "MAIN" | "STAR" | "GEM" | "BJ" | null;
  isSt?: boolean;
  className?: string;
}

const MARKET_LABEL: Record<NonNullable<StockBadgeProps["market"]>, string> = {
  MAIN: "主板",
  STAR: "科创",
  GEM: "创业",
  BJ: "北交",
};

export function StockBadge({
  code,
  name,
  market,
  isSt,
  className,
}: StockBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        isSt && "text-destructive",
        className,
      )}
    >
      <span className="font-mono tabular-nums text-muted-foreground">
        {code}
      </span>
      {name && <span className="font-medium">{name}</span>}
      {market && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {MARKET_LABEL[market]}
        </span>
      )}
      {isSt && (
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
          ST
        </span>
      )}
    </span>
  );
}
