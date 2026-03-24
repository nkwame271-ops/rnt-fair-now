import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bug, Lightbulb, ThumbsUp, MessageSquare, Mail, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

const categoryConfig: Record<string, { icon: any; label: string; variant: "destructive" | "secondary" | "default" }> = {
  bug: { icon: Bug, label: "Bug", variant: "destructive" },
  idea: { icon: Lightbulb, label: "Idea", variant: "secondary" },
  praise: { icon: ThumbsUp, label: "Love it", variant: "default" },
};

const RegulatorFeedback = () => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: fbData }, { data: contactData }] = await Promise.all([
        supabase.from("beta_feedback").select("*").order("created_at", { ascending: false }),
        supabase.from("contact_submissions" as any).select("*").order("created_at", { ascending: false }),
      ]);

      if (fbData && fbData.length > 0) {
        const userIds = [...new Set(fbData.map((f) => f.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        setFeedback(fbData.map((f) => ({ ...f, profile: profileMap.get(f.user_id) || null })));
      } else {
        setFeedback([]);
      }
      setContacts((contactData as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const markContactRead = async (id: string) => {
    const { error } = await supabase.from("contact_submissions" as any).update({ status: "read" } as any).eq("id", id);
    if (!error) {
      setContacts(contacts.map(c => c.id === id ? { ...c, status: "read" } : c));
      toast.success("Marked as read");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stats = {
    total: feedback.length,
    bugs: feedback.filter(f => f.category === "bug").length,
    ideas: feedback.filter(f => f.category === "idea").length,
    praise: feedback.filter(f => f.category === "praise").length,
  };

  const newContacts = contacts.filter(c => c.status === "new").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Feedback & Contact
        </h1>
        <p className="text-muted-foreground text-sm">Beta feedback and public contact submissions</p>
      </div>

      <Tabs defaultValue="feedback">
        <TabsList>
          <TabsTrigger value="feedback" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> Feedback ({feedback.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1">
            <Mail className="h-3.5 w-3.5" /> Contact Messages
            {newContacts > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{newContacts}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-4 mt-4">
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
              const profile = f.profile as any;
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
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3 mt-4">
          {contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No contact messages yet</div>
          ) : contacts.map((c) => (
            <div key={c.id} className={`bg-card rounded-xl p-4 border shadow-card ${c.status === "new" ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-card-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.email}</span>
                    {c.phone && <span className="text-xs text-muted-foreground">· {c.phone}</span>}
                    {c.status === "new" && <Badge variant="destructive" className="text-xs">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.message}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</div>
                  {c.status === "new" && (
                    <Button size="sm" variant="ghost" onClick={() => markContactRead(c.id)} className="text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Mark Read
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RegulatorFeedback;