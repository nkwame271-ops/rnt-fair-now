import { useState } from "react";
import { MessageCircle, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BetaFeedbackWidget from "@/components/BetaFeedbackWidget";
import LiveChatWidget from "@/components/LiveChatWidget";

type ActivePanel = null | "chat" | "feedback";

const FloatingActionHub = () => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSelect = (panel: ActivePanel) => {
    setActivePanel(panel);
    setMenuOpen(false);
  };

  const handleClose = () => {
    setActivePanel(null);
  };

  const handleFabClick = () => {
    if (activePanel) {
      handleClose();
    } else {
      setMenuOpen(!menuOpen);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {/* Active panel widget */}
      <AnimatePresence>
        {activePanel === "chat" && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="max-w-[calc(100vw-2rem)]"
          >
            <LiveChatWidget onClose={handleClose} />
          </motion.div>
        )}
        {activePanel === "feedback" && (
          <motion.div
            key="feedback-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="max-w-[calc(100vw-2rem)]"
          >
            <BetaFeedbackWidget onClose={handleClose} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu options */}
      <AnimatePresence>
        {menuOpen && !activePanel && (
          <>
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ delay: 0.05 }}
              onClick={() => handleSelect("chat")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-primary" />
              Chat Support
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              onClick={() => handleSelect("feedback")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-primary" />
              Beta Feedback
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* FAB button - always visible */}
      <button
        onClick={handleFabClick}
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95"
        aria-label="Help & Feedback"
      >
        {activePanel || menuOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
      </button>
    </div>
  );
};

export default FloatingActionHub;
