import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StaggeredGridProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

const StaggeredGrid = ({ children, className = "" }: StaggeredGridProps) => (
  <motion.div
    className={className}
    variants={container}
    initial="hidden"
    animate="show"
  >
    {children}
  </motion.div>
);

export const StaggeredItem = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} variants={staggerItem}>
    {children}
  </motion.div>
);

export default StaggeredGrid;
