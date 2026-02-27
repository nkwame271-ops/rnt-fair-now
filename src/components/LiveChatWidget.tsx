import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, MinusCircle, Bot, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  text: string;
  role: "user" | "bot" | "staff";
  time: string;
}

const FAQ_CHIPS = [
  "What is the max advance rent?",
  "How do I file a complaint?",
  "What are my rights as a tenant?",
  "How do I register a property?",
];

interface LiveChatWidgetProps {
  onClose?: () => void;
}

const LiveChatWidget = ({ onClose }: LiveChatWidgetProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(!onClose); // auto-open when used from hub
  const [mode, setMode] = useState<"ai" | "agent">("ai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: "greeting",
        text: "Hi! I'm the Rent Control Assistant. Ask me about tenant rights, rent laws, or complaints. 🏠",
        role: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      setMode("ai");
    }
  }, [open]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for agent mode
  useEffect(() => {
    if (!conversationId || mode !== "agent") return;
    const channel = supabase
      .channel(`support-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.is_staff) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, {
              id: msg.id,
              text: msg.message,
              role: "staff",
              time: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, mode]);

  const handleAISend = async (question: string) => {
    if (!question.trim()) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text: question.trim(),
      role: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setNewMsg("");
    setSending(true);

    try {
      const history = messages.filter((m) => m.id !== "greeting").map((m) => ({
        role: m.role === "user" ? "user" : "bot",
        text: m.text,
      }));

      const { data, error } = await supabase.functions.invoke("contact-assistant", {
        body: { question: question.trim(), history },
      });

      if (error) throw error;

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: data.reply,
        role: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);

      if (data.escalate) {
        setMessages((prev) => [...prev, {
          id: "escalate-prompt",
          text: "It sounds like you may need direct assistance from our team. Would you like to connect with a support agent?",
          role: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
      }
    } catch (err: any) {
      toast.error("Failed to get a response. Please try again.");
    }
    setSending(false);
  };

  const switchToAgent = async () => {
    if (!user) {
      toast.error("Please log in to chat with an agent.");
      return;
    }
    setSending(true);
    try {
      // Check for existing open conversation
      const { data: convs } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (convs && convs.length > 0) {
        convId = convs[0].id;
        // Load existing messages
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at");
        if (msgs) {
          const agentMsgs: ChatMessage[] = msgs.map((m: any) => ({
            id: m.id,
            text: m.message,
            role: m.is_staff ? "staff" : "user",
            time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }));
          setMessages((prev) => [...prev, ...agentMsgs]);
        }
      } else {
        const { data: conv, error } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id, subject: "Live Chat" })
          .select("id")
          .single();
        if (error) throw error;
        convId = conv.id;
      }

      setConversationId(convId);
      setMode("agent");
      setMessages((prev) => [...prev, {
        id: "agent-connected",
        text: "You're now connected to live support. A staff member will respond shortly.",
        role: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to agent");
    }
    setSending(false);
  };

  const handleAgentSend = async () => {
    if (!newMsg.trim() || !user || !conversationId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        message: newMsg.trim(),
        is_staff: false,
      });
      if (error) throw error;
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        text: newMsg.trim(),
        role: "user",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      setNewMsg("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    }
    setSending(false);
  };

  const handleSend = () => {
    if (mode === "ai") handleAISend(newMsg);
    else handleAgentSend();
  };

  return (
    <>
      {!onClose && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          aria-label="Open contact assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className={`${onClose ? '' : 'fixed bottom-6 right-6 z-50'} w-[min(370px,calc(100vw-2rem))] h-[min(520px,calc(100vh-6rem))] bg-card border border-border rounded-2xl shadow-elevated flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              {mode === "ai" ? <Bot className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
              <div>
                <div className="font-semibold text-sm">{mode === "ai" ? "Rent Control Assistant" : "Live Support"}</div>
                <div className="text-xs opacity-80">{mode === "ai" ? "AI-powered help" : "Connected to agent"}</div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setOpen(false); onClose?.(); }} className="p-1 rounded hover:bg-primary-foreground/20 transition-colors">
                <MinusCircle className="h-4 w-4" />
              </button>
              <button onClick={() => { setOpen(false); setMessages([]); setMode("ai"); setConversationId(null); onClose?.(); }} className="p-1 rounded hover:bg-primary-foreground/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "staff"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {msg.role === "staff" && <div className="text-[10px] font-semibold mb-0.5 opacity-70">Support Staff</div>}
                  {msg.role === "bot" && msg.id !== "greeting" && msg.id !== "escalate-prompt" && msg.id !== "agent-connected" && (
                    <div className="text-[10px] font-semibold mb-0.5 opacity-70">AI Assistant</div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div className="text-[10px] mt-1 opacity-50">{msg.time}</div>
                </div>
              </div>
            ))}

            {/* FAQ chips - only show at start in AI mode */}
            {mode === "ai" && messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {FAQ_CHIPS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAISend(q)}
                    disabled={sending}
                    className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-1.5 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Escalation button */}
            {mode === "ai" && messages.some((m) => m.id === "escalate-prompt") && (
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="default" onClick={switchToAgent} disabled={sending}>
                  <Headphones className="h-3.5 w-3.5 mr-1" /> Talk to an Agent
                </Button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Talk to Agent button (always visible in AI mode) */}
          {mode === "ai" && !messages.some((m) => m.id === "escalate-prompt") && messages.length > 1 && (
            <div className="px-4 pb-1">
              <button
                onClick={switchToAgent}
                disabled={sending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
              >
                <Headphones className="h-3 w-3" /> Talk to a live agent instead
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder={mode === "ai" ? "Ask about rent laws..." : "Type a message..."}
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
