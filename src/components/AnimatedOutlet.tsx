import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { motionTokens } from "@/lib/motion";

/**
 * Wraps <Outlet /> with AnimatePresence for slide-fade page transitions
 * keyed by pathname. Honours prefers-reduced-motion.
 */
const AnimatedOutlet = () => {
  const location = useLocation();
  const reduce = useReducedMotion();

  if (reduce) return <Outlet />;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: motionTokens.springGentle }}
        exit={{ opacity: 0, y: -8, transition: motionTokens.easeIn }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedOutlet;
