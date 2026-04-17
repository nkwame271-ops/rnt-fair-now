import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { motionTokens, cardHoverByTier } from "@/lib/motion";

type CardTier = "primary" | "secondary" | "row" | "default" | "none";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tier?: CardTier;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, tier = "default", ...props }, ref) => {
  const reduce = useReducedMotion();
  const hover = reduce
    ? { y: -1 }
    : tier === "none"
    ? undefined
    : cardHoverByTier[tier as keyof typeof cardHoverByTier] ?? cardHoverByTier.default;

  return (
    <motion.div
      ref={ref}
      data-card-tier={tier}
      className={cn("rounded-2xl border text-card-foreground glass-card", className)}
      whileHover={tier === "none" ? undefined : hover}
      transition={motionTokens.spring}
      {...(props as HTMLMotionProps<"div">)}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
