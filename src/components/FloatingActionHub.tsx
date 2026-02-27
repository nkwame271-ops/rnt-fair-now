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

  // If a panel is active, render it directly
  if (activePanel === "chat") {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <LiveChatWidget onClose={handleClose} />
      </div>
    );
  }

  if (activePanel === "feedback") {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <BetaFeedbackWidget onClose={handleClose} />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      <AnimatePresence>
        {menuOpen && (
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

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setMenuOpen(!menuOpen)}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Help & Feedback"
      >
        {menuOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>
    </div>
  );
};

export default FloatingActionHub;
