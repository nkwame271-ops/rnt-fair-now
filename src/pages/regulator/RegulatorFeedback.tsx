import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bug, Lightbulb, ThumbsUp, MessageSquare, Mail, CheckCircle2, Reply, Send, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { toast } from "sonner";

const categoryConfig: Record<string, { icon: any; label: string; variant: "destructive" | "secondary" | "default" }> = {
  bug: { icon: Bug, label: "Bug", variant: "destructive" },
  idea: { icon: Lightbulb, label: "Idea", variant: "secondary" },
  praise: { icon: ThumbsUp, label: "Love it", variant: "default" },
};

const renderTemplate = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

const RegulatorFeedback = () => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [replies, setReplies] = useState<Record<string, any[]>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reply dialog state
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: fbData }, { data: contactData }, { data: tplData }] = await Promise.all([
        supabase.from("beta_feedback").select("*").order("created_at", { ascending: false }),
        supabase.from("contact_submissions" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("contact_reply_templates" as any).select("*").order("name"),
      ]);

      if (fbData && fbData.length > 0) {
        const userIds = [...new Set(fbData.map((f) => f.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        setFeedback(fbData.map((f) => ({ ...f, profile: profileMap.get(f.user_id) || null })));
      } else {
        setFeedback([]);
      }
      const cs = (contactData as any[]) || [];
      setContacts(cs);
      setTemplates((tplData as any[]) || []);

      if (cs.length > 0) {
        const ids = cs.map((c: any) => c.id);
        const { data: rep } = await supabase
          .from("contact_message_replies" as any)
          .select("*")
          .in("submission_id", ids)
          .order("created_at", { ascending: false });
        const grouped: Record<string, any[]> = {};
        ((rep as any[]) || []).forEach((r) => {
          (grouped[r.submission_id] ||= []).push(r);
        });
        setReplies(grouped);
      }
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

  const openReply = (contact: any) => {
    setReplyTarget(contact);
    const defaultChannel: "email" | "sms" = contact.email ? "email" : "sms";
    setChannel(defaultChannel);
    setTemplateId("");
    setSubject("");
    setBody("");
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "_blank") {
      setSubject("");
      setBody("");
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (!tpl || !replyTarget) return;
    const vars = { name: replyTarget.name || "there", email: replyTarget.email || "", phone: replyTarget.phone || "" };
    setSubject(renderTemplate(tpl.subject || "", vars));
    setBody(renderTemplate(tpl.body || "", vars));
    if (tpl.channel === "sms" || tpl.channel === "email") setChannel(tpl.channel);
  };

  const sendReply = async () => {
    if (!replyTarget) return;
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }
    if (channel === "email" && !replyTarget.email) {
      toast.error("This contact has no email address");
      return;
    }
    if (channel === "sms" && !replyTarget.phone) {
      toast.error("This contact has no phone number");
      return;
    }
    setSending(true);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const { data, error } = await supabase.functions.invoke("contact-reply", {
        body: {
          submission_id: replyTarget.id,
          channel,
          subject: channel === "email" ? subject : undefined,
          body,
          template_used: tpl?.name || null,
        },
      });
      if (error) throw new Error(error.message || "Failed to send reply");
      const d = (data as any) || {};
      if (d.success === false) {
        toast.warning(d.error || "Reply logged but delivery failed");
      } else if (d.error) {
        throw new Error(d.error);
      } else {
        toast.success(`Reply sent via ${channel.toUpperCase()}`);
      }
      const reply = d.reply;
      if (reply) {
        setReplies((prev) => ({
          ...prev,
          [replyTarget.id]: [reply, ...(prev[replyTarget.id] || [])],
        }));
      }
      setContacts((prev) =>
        prev.map((c) =>
          c.id === replyTarget.id
            ? { ...c, status: "replied", reply_count: (c.reply_count || 0) + 1, last_replied_at: new Date().toISOString() }
            : c
        )
      );
      setReplyTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    } finally {
      setSending(false);
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

  const statusBadge = (c: any) => {
    if (c.status === "replied") return <Badge variant="default" className="text-xs">Replied</Badge>;
    if (c.status === "new") return <Badge variant="destructive" className="text-xs">New</Badge>;
    return <Badge variant="secondary" className="text-xs">Read</Badge>;
  };

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
          ) : contacts.map((c) => {
            const repList = replies[c.id] || [];
            return (
              <div key={c.id} className={`bg-card rounded-xl p-4 border shadow-card ${c.status === "new" ? "border-primary/40" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm text-card-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.email}</span>
                      {c.phone && <span className="text-xs text-muted-foreground">· {c.phone}</span>}
                      {statusBadge(c)}
                      {(c.reply_count || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">{c.reply_count} repl{c.reply_count === 1 ? "y" : "ies"}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.message}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1 flex flex-col items-end">
                    <div className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => openReply(c)} className="text-xs gap-1 h-7">
                        <Reply className="h-3 w-3" /> Reply
                      </Button>
                      {c.status === "new" && (
                        <Button size="sm" variant="ghost" onClick={() => markContactRead(c.id)} className="text-xs gap-1 h-7">
                          <CheckCircle2 className="h-3 w-3" /> Read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {repList.length > 0 && (
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 px-2">
                        <History className="h-3 w-3" /> Reply history ({repList.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      {repList.map((r) => (
                        <div key={r.id} className="bg-muted/40 rounded-md p-2 border border-border/50 text-xs space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] uppercase">{r.channel}</Badge>
                            <span>{format(new Date(r.created_at), "MMM d, h:mm a")}</span>
                            {r.template_used && <span className="italic">· {r.template_used}</span>}
                          </div>
                          {r.subject && <div className="font-medium text-card-foreground">{r.subject}</div>}
                          <div className="whitespace-pre-wrap text-card-foreground/90">{r.body}</div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Reply Dialog */}
      <Dialog open={!!replyTarget} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5 text-primary" /> Reply to {replyTarget?.name}
            </DialogTitle>
          </DialogHeader>
          {replyTarget && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 border border-border/50">
                <div><strong>Email:</strong> {replyTarget.email || "—"}</div>
                <div><strong>Phone:</strong> {replyTarget.phone || "—"}</div>
                <div className="mt-1 italic">"{replyTarget.message}"</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email" disabled={!replyTarget.email}>Email</SelectItem>
                      <SelectItem value="sms" disabled={!replyTarget.phone}>SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Template</Label>
                  <Select value={templateId} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_blank">Blank message</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {channel === "email" && (
                <div className="space-y-1">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Reply subject" maxLength={200} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Message {channel === "sms" && <span className="text-muted-foreground">({body.length}/480)</span>}</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  maxLength={channel === "sms" ? 480 : 5000}
                  placeholder="Type your reply…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)} disabled={sending}>Cancel</Button>
            <Button onClick={sendReply} disabled={sending || !body.trim()} className="gap-1">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegulatorFeedback;
