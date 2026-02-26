import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const categories = [
  { value: "bug", label: "Bug", icon: Bug },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "praise", label: "Love it", icon: ThumbsUp },
] as const;

const LandlordFeedback = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);

  const loadRecent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("beta_feedback")
      .select("id, category, message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentFeedback(data || []);
  };

  useEffect(() => {
    loadRecent();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!message.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

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
      return;
    }

    toast.success("Thanks for your feedback!");
    setMessage("");
    loadRecent();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Beta Feedback
        </h1>
        <p className="text-muted-foreground mt-1">Report bugs and share ideas for this beta version.</p>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border shadow-card space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.value}
                type="button"
                variant={category === cat.value ? "default" : "outline"}
                onClick={() => setCategory(cat.value)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what is not working or what should be improved..."
          className="min-h-[140px]"
          maxLength={500}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{message.length}/500</span>
          <Button onClick={handleSubmit} disabled={sending || !message.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Submit Feedback"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border shadow-card space-y-3">
        <h2 className="text-lg font-semibold text-card-foreground">Your Recent Feedback</h2>
        {recentFeedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {recentFeedback.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="capitalize">{item.category}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-card-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LandlordFeedback;
