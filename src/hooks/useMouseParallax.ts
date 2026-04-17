import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Tracks normalised mouse position (-0.5 to 0.5) on a container.
 * Uses requestAnimationFrame throttling. Disabled below 768px or when reduced-motion.
 */
export function useMouseParallax<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    const el = ref.current ?? document.body;
    if (!el) return;

    let raf = 0;
    let next = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      next = { x: Math.max(-0.5, Math.min(0.5, x)), y: Math.max(-0.5, Math.min(0.5, y)) };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          setPos(next);
          raf = 0;
        });
      }
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      setPos({ x: 0, y: 0 });
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const styleFor = (depth: "bg" | "mid" | "fg") => {
    if (reduce) return { transform: "translate3d(0,0,0)" };
    const m = depth === "bg" ? { x: 12, y: 8, t: "0.8s" } : depth === "mid" ? { x: 28, y: 18, t: "0.5s" } : { x: 50, y: 32, t: "0.3s" };
    return {
      transform: `translate3d(${pos.x * m.x}px, ${pos.y * m.y}px, 0)`,
      transition: `transform ${m.t} ease-out`,
      willChange: "transform" as const,
    };
  };

  return { ref, pos, styleFor };
}
