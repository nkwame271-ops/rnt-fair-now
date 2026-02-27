import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, MinusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Message {
  id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  sender_user_id: string;
}

const LiveChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load or create conversation
  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      setLoading(true);
      // Find existing open conversation
      const { data: convs } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        setConversationId(convs[0].id);
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", convs[0].id)
          .order("created_at");
        setMessages(msgs || []);
      } else {
        setConversationId(null);
        setMessages([]);
      }
      setLoading(false);
    };
    load();
  }, [user, open]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || !user) return;
    setSending(true);
    try {
      let convId = conversationId;
      if (!convId) {
        const { data: conv, error: convErr } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id, subject: "Live Chat" })
          .select("id")
          .single();
        if (convErr) throw convErr;
        convId = conv.id;
        setConversationId(convId);
      }

      const { error } = await supabase.from("support_messages").insert({
        conversation_id: convId,
        sender_user_id: user.id,
        message: newMsg.trim(),
        is_staff: false,
      });
      if (error) throw error;
      setNewMsg("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    }
    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          aria-label="Open live chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-2xl shadow-elevated flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div>
              <div className="font-semibold text-sm">Customer Care</div>
              <div className="text-xs opacity-80">Rent Control Department</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-primary-foreground/20 transition-colors">
                <MinusCircle className="h-4 w-4" />
              </button>
              <button onClick={() => { setOpen(false); }} className="p-1 rounded hover:bg-primary-foreground/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Welcome! How can we help you today?</p>
                <p className="text-xs mt-1">Send a message to start a conversation.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.is_staff ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.is_staff
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.is_staff && <div className="text-[10px] font-semibold mb-0.5 opacity-70">Support Staff</div>}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <div className={`text-[10px] mt-1 ${msg.is_staff ? "opacity-50" : "opacity-70"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Type a message..."
                className="min-h-[40px] max-h-[80px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
              />
              <Button type="submit" size="icon" disabled={sending || !newMsg.trim()} className="shrink-0 h-10 w-10">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveChatWidget;
