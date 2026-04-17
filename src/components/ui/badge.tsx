import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-[4px]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary hover:bg-primary/20",
        secondary: "border-transparent bg-muted text-foreground hover:bg-muted/80",
        destructive: "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/15 text-success hover:bg-success/20",
        warning: "border-transparent bg-warning/20 text-warning-foreground hover:bg-warning/30",
        info: "border-transparent bg-info/15 text-info hover:bg-info/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn(badgeVariants({ variant }), className)}
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduce ? { duration: 0.01 } : motionTokens.springSnappy}
      {...(props as HTMLMotionProps<"div">)}
    />
  );
}

export { Badge, badgeVariants };
