import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import RequestComplaintPaymentDialog from "@/components/RequestComplaintPaymentDialog";

interface Note {
  id: string;
  body: string;
  author_user_id: string;
  author_role: string;
  created_at: string;
  authorName?: string;
}

interface Props {
  complaintId: string;
  currentStatus: string;
  feeScope: "nugs" | "rent_control";
  /** Show the request-payment button */
  allowPayment?: boolean;
  /** When true, show status update controls */
  allowStatusUpdate?: boolean;
  monthlyRent?: number | null;
  linkedPropertyId?: string | null;
  onChanged?: () => void;
}

const STATUS_OPTIONS = [
  "submitted",
  "under_review",
  "in_progress",
  "pending_payment",
  "scheduled",
  "resolved",
  "closed",
];

const ComplaintWorkspace = ({
  complaintId,
  currentStatus,
  feeScope,
  allowPayment = true,
  allowStatusUpdate = true,
  monthlyRent,
  linkedPropertyId,
  onChanged,
}: Props) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [savingStatus, setSavingStatus] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const loadNotes = async () => {
    setLoading(true);
    const { data } = await (supabase.from("complaint_notes") as any)
      .select("id, body, author_user_id, author_role, created_at")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });

    const userIds = [...new Set((data || []).map((n: any) => n.author_user_id))];
    let nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds as string[]);
      (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
    }
    setNotes((data || []).map((n: any) => ({ ...n, authorName: nameMap[n.author_user_id] })));
    setLoading(false);
  };

  useEffect(() => { loadNotes(); /* eslint-disable-next-line */ }, [complaintId]);
  useEffect(() => { setStatus(currentStatus); }, [currentStatus]);

  const addNote = async () => {
    if (!user || !body.trim()) return;
    setPosting(true);
    const { error } = await (supabase.from("complaint_notes") as any).insert({
      complaint_id: complaintId,
      author_user_id: user.id,
      author_role: feeScope === "nugs" ? "nugs" : "rent_control",
      body: body.trim(),
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    loadNotes();
  };

  const removeNote = async (id: string) => {
    const { error } = await (supabase.from("complaint_notes") as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const updateStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setSavingStatus(true);
    const { error } = await supabase
      .from("complaints")
      .update({ status: newStatus })
      .eq("id", complaintId);
    setSavingStatus(false);
    if (error) { toast.error(error.message); setStatus(currentStatus); return; }
    toast.success("Status updated");
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 border border-border rounded-lg p-3">
        {allowStatusUpdate && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <Select value={status} onValueChange={(v) => { setStatus(v); updateStatus(v); }} disabled={savingStatus}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {allowPayment && (() => {
          const paid = ["paid", "completed", "success"].includes((currentStatus || "").toLowerCase());
          const hasRequest = ["pending_payment", "paid", "completed", "success"].includes((currentStatus || "").toLowerCase());
          return (
            <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)} className="ml-auto">
              {paid ? "Request Additional Payment" : hasRequest ? "Update Payment Request" : "Set Type & Request Payment"}
            </Button>
          );
        })()}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquarePlus className="h-3.5 w-3.5" /> Add internal note
        </label>
        <Textarea
          placeholder="Notes are visible to NUGS and Rent Control admins working this case…"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={addNote} disabled={posting || !body.trim()}>
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post note"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs">
                  <span className="font-semibold text-foreground">{n.authorName || "Admin"}</span>
                  <span className="text-muted-foreground"> · {n.author_role.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "MMM d, h:mma")}</span>
                  {n.author_user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeNote(n.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))
        )}
      </div>

      <RequestComplaintPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        complaintId={complaintId}
        complaintTable="complaints"
        linkedPropertyId={linkedPropertyId}
        monthlyRent={monthlyRent ?? null}
        feeScope={feeScope}
        onRequested={onChanged}
      />
    </div>
  );
};

export default ComplaintWorkspace;
