import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { pageVariants } from "@/lib/motion";

const PageTransition = ({ children }: { children: ReactNode }) => {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
};

export default PageTransition;
