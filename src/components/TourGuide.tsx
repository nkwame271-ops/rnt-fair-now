import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  /** CSS selector for the target element */
  target: string;
  /** Title of the step */
  title: string;
  /** Description of the step */
  description: string;
  /** Which side to show the tooltip */
  placement?: "top" | "bottom" | "left" | "right";
}

interface TourGuideProps {
  steps: TourStep[];
  storageKey: string;
  onComplete?: () => void;
}

const TourGuide = ({ steps, storageKey, onComplete }: TourGuideProps) => {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showButton, setShowButton] = useState(false);
  const rafRef = useRef<number>();

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Auto-start on first visit after a short delay
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    } else {
      setShowButton(true);
    }
  }, [storageKey]);

  const updateTargetRect = useCallback(() => {
    if (!active || !steps[currentStep]) return;
    const el = document.querySelector(steps[currentStep].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      setTargetRect(null);
    }
  }, [active, currentStep, steps]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [updateTargetRect]);

  const finish = useCallback(() => {
    setActive(false);
    setCurrentStep(0);
    localStorage.setItem(storageKey, "true");
    setShowButton(true);
    onComplete?.();
  }, [storageKey, onComplete]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const restart = () => {
    setCurrentStep(0);
    setActive(true);
  };

  const step = steps[currentStep];
  const placement = step?.placement || "bottom";

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const pad = 16;
    switch (placement) {
      case "bottom":
        return { top: targetRect.bottom + pad, left: targetRect.left + targetRect.width / 2, transform: "translateX(-50%)" };
      case "top":
        return { top: targetRect.top - pad, left: targetRect.left + targetRect.width / 2, transform: "translate(-50%, -100%)" };
      case "right":
        return { top: targetRect.top + targetRect.height / 2, left: targetRect.right + pad, transform: "translateY(-50%)" };
      case "left":
        return { top: targetRect.top + targetRect.height / 2, left: targetRect.left - pad, transform: "translate(-100%, -50%)" };
      default:
        return { top: targetRect.bottom + pad, left: targetRect.left + targetRect.width / 2, transform: "translateX(-50%)" };
    }
  };

  return (
    <>
      {/* Help button to restart tour */}
      {showButton && !active && (
        <button
          onClick={restart}
          className="fixed bottom-6 right-6 z-[60] bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90 transition-colors"
          title="Start guided tour"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {active && (
          <>
            {/* Overlay with cutout */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998]"
              style={{ pointerEvents: "none" }}
            >
              <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "auto" }}>
                <defs>
                  <mask id="tour-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {targetRect && (
                      <rect
                        x={targetRect.left - 6}
                        y={targetRect.top - 6}
                        width={targetRect.width + 12}
                        height={targetRect.height + 12}
                        rx="8"
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#tour-mask)"
                  onClick={finish}
                />
              </svg>

              {/* Highlight ring */}
              {targetRect && (
                <div
                  className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
                  style={{
                    top: targetRect.top - 6,
                    left: targetRect.left - 6,
                    width: targetRect.width + 12,
                    height: targetRect.height + 12,
                  }}
                />
              )}
            </motion.div>

            {/* Tooltip */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed z-[999] bg-card border border-border rounded-xl shadow-elevated p-5 max-w-sm"
              style={{ ...getTooltipStyle(), pointerEvents: "auto" }}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-card-foreground text-sm">{step?.title}</h3>
                <button onClick={finish} className="text-muted-foreground hover:text-foreground p-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">{step?.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {currentStep + 1} / {steps.length}
                </span>
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-2">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={next} className="h-8 px-3 text-xs">
                    {currentStep === steps.length - 1 ? "Finish" : "Next"}
                    {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TourGuide;
