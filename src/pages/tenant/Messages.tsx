import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface Conversation {
  unit_id: string;
  other_user_id: string;
  other_user_name: string;
  unit_name: string;
  last_message: string;
  last_at: string;
  unread: number;
}

interface Message {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
  read: boolean;
}

const TenantMessages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchConversations();

    const channel = supabase
      .channel('tenant-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'marketplace_messages' }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_user_id === user.id || msg.sender_user_id === user.id) {
          fetchConversations();
          if (activeConvo && msg.unit_id === activeConvo.unit_id) {
            setMessages(prev => [...prev, msg]);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("marketplace_messages")
      .select("*")
      .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) { setConversations([]); setLoading(false); return; }

    // Group by unit_id + other_user
    const convMap = new Map<string, { unit_id: string; other_user_id: string; messages: any[] }>();
    data.forEach(m => {
      const otherId = m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id;
      const key = `${m.unit_id}_${otherId}`;
      if (!convMap.has(key)) convMap.set(key, { unit_id: m.unit_id, other_user_id: otherId, messages: [] });
      convMap.get(key)!.messages.push(m);
    });

    const otherIds = [...new Set([...convMap.values()].map(c => c.other_user_id))];
    const unitIds = [...new Set([...convMap.values()].map(c => c.unit_id))];

    const [{ data: profiles }, { data: units }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", otherIds),
      supabase.from("units").select("id, unit_name").in("id", unitIds),
    ]);

    const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    const unitMap = new Map((units || []).map(u => [u.id, u.unit_name]));

    const convos: Conversation[] = [...convMap.values()].map(c => {
      const sorted = c.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return {
        unit_id: c.unit_id,
        other_user_id: c.other_user_id,
        other_user_name: nameMap.get(c.other_user_id) || "Unknown",
        unit_name: unitMap.get(c.unit_id) || "Property",
        last_message: sorted[0].message,
        last_at: sorted[0].created_at,
        unread: sorted.filter((m: any) => m.receiver_user_id === user.id && !m.read).length,
      };
    }).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

    setConversations(convos);
    setLoading(false);
  };

  const openConvo = async (convo: Conversation) => {
    setActiveConvo(convo);
    const { data } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("unit_id", convo.unit_id)
      .or(`and(sender_user_id.eq.${user!.id},receiver_user_id.eq.${convo.other_user_id}),and(sender_user_id.eq.${convo.other_user_id},receiver_user_id.eq.${user!.id})`)
      .order("created_at", { ascending: true });

    setMessages(data || []);

    // Mark as read
    await supabase.from("marketplace_messages").update({ read: true })
      .eq("unit_id", convo.unit_id)
      .eq("sender_user_id", convo.other_user_id)
      .eq("receiver_user_id", user!.id);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSend = async () => {
    if (!user || !activeConvo || !newMsg.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("marketplace_messages").insert({
        sender_user_id: user.id,
        receiver_user_id: activeConvo.other_user_id,
        unit_id: activeConvo.unit_id,
        message: newMsg.trim(),
      });
      if (error) throw error;
      setNewMsg("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (activeConvo) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setActiveConvo(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="font-semibold text-foreground">{activeConvo.other_user_name}</h2>
            <p className="text-xs text-muted-foreground">{activeConvo.unit_name}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_user_id === user!.id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                m.sender_user_id === user!.id
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}>
                <p>{m.message}</p>
                <p className={`text-[10px] mt-1 ${m.sender_user_id === user!.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {format(new Date(m.created_at), "h:mm a")}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 pt-3 border-t border-border">
          <Textarea value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a message..." rows={1} className="flex-1 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button onClick={handleSend} disabled={sending || !newMsg.trim()} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><MessageCircle className="h-7 w-7 text-primary" /> Messages</h1>
        <p className="text-muted-foreground mt-1">Your conversations with landlords</p>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center">
          <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No messages yet. Send a message from the Marketplace to start a conversation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <button key={`${c.unit_id}_${c.other_user_id}`} onClick={() => openConvo(c)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary/30 hover:shadow-card transition-all flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-card-foreground text-sm truncate">{c.other_user_name}</h3>
                  <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(c.last_at), "MMM d")}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.unit_name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
              </div>
              {c.unread > 0 && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantMessages;
