import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";

interface Conversation {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  last_message?: string;
  unread?: boolean;
}

interface Message {
  id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  sender_user_id: string;
}

const RegulatorSupportChats = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      const { data: convs } = await supabase
        .from("support_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (convs) {
        // Fetch user names
        const userIds = [...new Set(convs.map((c) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.full_name]));

        setConversations(
          convs.map((c) => ({
            ...c,
            user_name: nameMap[c.user_id] || "Unknown User",
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      setLoadingMsgs(true);
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selected)
        .order("created_at");
      setMessages(msgs || []);
      setLoadingMsgs(false);
    };
    load();
  }, [selected]);

  // Realtime for selected conversation
  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`admin-support-${selected}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${selected}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReply = async () => {
    if (!reply.trim() || !user || !selected) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: selected,
        sender_user_id: user.id,
        message: reply.trim(),
        is_staff: true,
      });
      if (error) throw error;
      setReply("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    }
    setSending(false);
  };

  const handleClose = async (convId: string) => {
    await supabase.from("support_conversations").update({ status: "closed" }).eq("id", convId);
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, status: "closed" } : c)));
    toast.success("Conversation closed");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Support Chats</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
          {/* Conversation list */}
          <div className="border border-border rounded-xl overflow-hidden flex flex-col bg-card">
            <div className="p-3 border-b border-border font-semibold text-sm text-foreground">
              Conversations ({conversations.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No conversations yet</div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelected(conv.id)}
                    className={`w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors ${
                      selected === conv.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-card-foreground truncate">{conv.user_name}</span>
                      <Badge variant={conv.status === "open" ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {conv.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{conv.subject}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="lg:col-span-2 border border-border rounded-xl overflow-hidden flex flex-col bg-card">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select a conversation to view</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">
                    {conversations.find((c) => c.id === selected)?.user_name}
                  </span>
                  {conversations.find((c) => c.id === selected)?.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => handleClose(selected)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Close
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.is_staff ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                            msg.is_staff ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {!msg.is_staff && <div className="text-[10px] font-semibold mb-0.5 opacity-70">User</div>}
                          {msg.is_staff && <div className="text-[10px] font-semibold mb-0.5 opacity-70">You (Staff)</div>}
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <div className="text-[10px] mt-1 opacity-60">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply */}
                {conversations.find((c) => c.id === selected)?.status === "open" && (
                  <div className="p-3 border-t border-border">
                    <form onSubmit={(e) => { e.preventDefault(); handleReply(); }} className="flex gap-2">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Type a reply..."
                        className="min-h-[40px] max-h-[80px] resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
                        }}
                      />
                      <Button type="submit" size="icon" disabled={sending || !reply.trim()} className="shrink-0 h-10 w-10">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default RegulatorSupportChats;
