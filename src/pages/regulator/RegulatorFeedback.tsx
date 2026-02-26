import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bug, Lightbulb, ThumbsUp, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const categoryConfig: Record<string, { icon: any; label: string; variant: "destructive" | "secondary" | "default" }> = {
  bug: { icon: Bug, label: "Bug", variant: "destructive" },
  idea: { icon: Lightbulb, label: "Idea", variant: "secondary" },
  praise: { icon: ThumbsUp, label: "Love it", variant: "default" },
};

const RegulatorFeedback = () => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("beta_feedback")
        .select("*, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false });
      setFeedback(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stats = {
    total: feedback.length,
    bugs: feedback.filter(f => f.category === "bug").length,
    ideas: feedback.filter(f => f.category === "idea").length,
    praise: feedback.filter(f => f.category === "praise").length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Beta Feedback
        </h1>
        <p className="text-muted-foreground text-sm">Real-time feedback from beta testers</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: MessageSquare, color: "text-primary" },
          { label: "Bugs", value: stats.bugs, icon: Bug, color: "text-destructive" },
          { label: "Ideas", value: stats.ideas, icon: Lightbulb, color: "text-warning" },
          { label: "Praise", value: stats.praise, icon: ThumbsUp, color: "text-success" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-4 border border-border shadow-card">
            <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
            <div className="text-2xl font-bold text-card-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {feedback.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No feedback yet</div>
        ) : feedback.map((f) => {
          const cat = categoryConfig[f.category] || categoryConfig.bug;
          const CatIcon = cat.icon;
          const profile = f.profiles as any;
          return (
            <div key={f.id} className="bg-card rounded-xl p-4 border border-border shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={cat.variant} className="text-xs gap-1">
                      <CatIcon className="h-3 w-3" /> {cat.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{f.page_url}</span>
                  </div>
                  <p className="text-sm text-card-foreground">{f.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-medium text-card-foreground">{profile?.full_name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(f.created_at), "MMM d, h:mm a")}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegulatorFeedback;
