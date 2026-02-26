import { useState } from "react";
import { MessageSquare, X, Send, Bug, Lightbulb, ThumbsUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const categories = [
  { value: "bug", label: "Bug", icon: Bug, color: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "idea", label: "Idea", icon: Lightbulb, color: "bg-warning/10 text-warning border-warning/30" },
  { value: "praise", label: "Love it", icon: ThumbsUp, color: "bg-success/10 text-success border-success/30" },
];

const BetaFeedbackWidget = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (loading || !user) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { error } = await supabase.from("beta_feedback").insert({
      user_id: user.id,
      page_url: window.location.pathname,
      category,
      message: message.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Failed to send feedback");
    } else {
      toast.success("Thanks for your feedback! 🎉");
      setMessage("");
      setOpen(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-3 w-80 rounded-2xl border border-border bg-card shadow-elevated p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Beta Feedback</h3>
                <p className="text-xs text-muted-foreground">Help us improve!</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    category === cat.value ? cat.color + " ring-1 ring-current" : "bg-muted/50 text-muted-foreground border-transparent"
                  }`}
                >
                  <cat.icon className="h-3 w-3" />
                  {cat.label}
                </button>
              ))}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "bug" ? "What went wrong? Which page?" :
                category === "idea" ? "What would you like to see?" :
                "What do you love about the app?"
              }
              className="min-h-[80px] text-sm resize-none mb-3"
              maxLength={500}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{message.length}/500</span>
              <Button size="sm" onClick={handleSubmit} disabled={!message.trim() || sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Send
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </motion.button>
    </div>
  );
};

export default BetaFeedbackWidget;
