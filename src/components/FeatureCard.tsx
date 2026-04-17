import * as React from "react";
import { cn } from "@/lib/utils";

type FeatureCardVariant = "primary" | "teal" | "dark" | "amber";

interface FeatureCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: FeatureCardVariant;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
}

const variantBg: Record<FeatureCardVariant, string> = {
  primary: "bg-[hsl(var(--feature-card-primary))]",
  teal: "bg-[hsl(var(--feature-card-teal))]",
  dark: "bg-[hsl(var(--feature-card-dark))]",
  amber: "bg-[hsl(var(--feature-card-amber))]",
};

const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, variant = "primary", eyebrow, title, value, trailing, icon, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex flex-col justify-between rounded-2xl p-5 text-white min-h-[140px] overflow-hidden",
          variantBg[variant],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] font-medium text-white/70">{eyebrow}</div>
          {icon && <div className="text-white/80">{icon}</div>}
        </div>
        {title && <div className="text-sm font-medium text-white/95 mt-2 leading-snug">{title}</div>}
        <div className="flex items-end justify-between gap-3 mt-4">
          {value !== undefined && <div className="text-3xl font-bold tracking-tight text-white">{value}</div>}
          {trailing && <div className="text-white/80">{trailing}</div>}
        </div>
        {children}
      </div>
    );
  },
);
FeatureCard.displayName = "FeatureCard";

export { FeatureCard };
export type { FeatureCardVariant };
