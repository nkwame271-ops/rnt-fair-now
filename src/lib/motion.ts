import type { Transition, Variants } from "framer-motion";

export const motionTokens = {
  spring: { type: "spring", stiffness: 400, damping: 28 } as Transition,
  springBouncy: { type: "spring", stiffness: 340, damping: 22 } as Transition,
  springGentle: { type: "spring", stiffness: 200, damping: 30 } as Transition,
  springSnappy: { type: "spring", stiffness: 500, damping: 20 } as Transition,
  easeOut: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } as Transition,
  easeIn: { duration: 0.2, ease: [0.4, 0, 1, 1] } as Transition,
  staggerChildren: 0.06,
  staggerFast: 0.04,
};

export const listContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: motionTokens.staggerChildren } },
};

export const listContainerFastVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: motionTokens.staggerFast } },
};

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 24 },
  },
};

export const metricItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 24 },
  },
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: motionTokens.springGentle },
  exit: { opacity: 0, y: -8, transition: motionTokens.easeIn },
};

// Hover lift presets keyed by tier ("primary" | "secondary" | "row" | "default")
export const cardHoverByTier = {
  primary: { y: -10, scale: 1.02 },
  secondary: { y: -5, scale: 1.015 },
  row: { y: -3, scale: 1.005 },
  default: { y: -6, scale: 1.015 },
};
