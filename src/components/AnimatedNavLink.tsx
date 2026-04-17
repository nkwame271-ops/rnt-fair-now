import { NavLink, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { motionTokens } from "@/lib/motion";

interface AnimatedNavLinkProps {
  to: string;
  layoutId: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  children: ReactNode;
}

/**
 * NavLink with a sliding active pill (Framer layoutId) and subtle hover.
 * Pill animates between items rather than jumping.
 */
const AnimatedNavLink = ({ to, layoutId, onClick, onMouseEnter, children }: AnimatedNavLinkProps) => {
  const location = useLocation();
  const reduce = useReducedMotion();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={() =>
        `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
          isActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`
      }
    >
      {isActive && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 rounded-lg bg-sidebar-accent"
          transition={reduce ? { duration: 0.01 } : { type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2.5 w-full min-w-0">{children}</span>
    </NavLink>
  );
};

export default AnimatedNavLink;
