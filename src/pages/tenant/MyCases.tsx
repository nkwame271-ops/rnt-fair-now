import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle2, AlertTriangle, Loader2, CreditCard, CalendarDays, Hash, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AppointmentSlotPicker from "@/components/AppointmentSlotPicker";

const statusIcon: Record<string, React.ReactNode> = {
  awaiting_payment: <Clock className="h-4 w-4 text-info" />,
  submitted: <Clock className="h-4 w-4 text-info" />,
  pending_payment: <CreditCard className="h-4 w-4 text-warning" />,
  under_review: <AlertTriangle className="h-4 w-4 text-warning" />,
  in_progress: <Clock className="h-4 w-4 text-primary" />,
  ready_for_scheduling: <CalendarDays className="h-4 w-4 text-primary" />,
  scheduled: <CalendarDays className="h-4 w-4 text-accent-foreground" />,
  schedule_complainant: <CalendarDays className="h-4 w-4 text-accent-foreground" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const statusColors: Record<string, string> = {
  awaiting_payment: "bg-info/10 text-info",
  submitted: "bg-info/10 text-info",
  pending_payment: "bg-warning/10 text-warning",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  ready_for_scheduling: "bg-primary/10 text-primary",
  scheduled: "bg-accent/10 text-accent-foreground",
  schedule_complainant: "bg-accent/10 text-accent-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  awaiting_payment: "Submitted — Awaiting Review",
  submitted: "Submitted",
  pending_payment: "Payment Requested",
  under_review: "Under Review",
  in_progress: "In Progress",
  ready_for_scheduling: "Ready for Scheduling",
  scheduled: "Scheduled",
  schedule_complainant: "Scheduling",
  resolved: "Resolved",
  closed: "Closed",
};

const MyCases = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scheduleMap, setScheduleMap] = useState<Record<string, any>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const [basketMap, setBasketMap] = useState<Record<string, any[]>>({});

  const fetchComplaints = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false });
    setComplaints(data || []);

    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: schedules } = await supabase
        .from("complaint_schedules")
        .select("*")
        .in("complaint_id", ids)
        .in("status", ["pending_selection", "confirmed"]);
      if (schedules) {
        const map: Record<string, any> = {};
        schedules.forEach((s: any) => { map[s.complaint_id] = s; });
        setScheduleMap(map);
      }

      // Load basket items for any complaint awaiting payment
      const payIds = data.filter((c: any) => c.payment_status === "pending" && Number(c.outstanding_amount) > 0).map((c: any) => c.id);
      if (payIds.length > 0) {
        const { data: items } = await (supabase.from("complaint_basket_items") as any)
          .select("id, complaint_id, label, amount, kind")
          .in("complaint_id", payIds)
          .eq("complaint_table", "complaints")
          .order("created_at");
        const bm: Record<string, any[]> = {};
        (items || []).forEach((it: any) => { (bm[it.complaint_id] ||= []).push(it); });
        setBasketMap(bm);
      }
    }
    setLoading(false);
  };

  // Auto-verify payment on return from Paystack
  useEffect(() => {
    if (!user) return;
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (reference) {
      const verifyPayment = async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-payment", { body: { reference } });
          if (data?.verified) toast.success("Payment confirmed! Your complaint is now ready for scheduling.");
        } catch (_) {}
        setSearchParams({}, { replace: true });
        await new Promise((r) => setTimeout(r, 1500));
        await fetchComplaints();
        setTimeout(() => fetchComplaints(), 3000);
      };
      verifyPayment();
    } else {
      fetchComplaints();
    }
  }, [user]);

  // Realtime: refresh when admin requests payment / status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`complaints:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "complaints", filter: `tenant_user_id=eq.${user.id}` }, () => {
        fetchComplaints();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handlePayNow = async (complaint: any) => {
    setPaying(complaint.id);
    try {
      const { data: rawData, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "complaint_fee", complaintId: complaint.id },
      });
      let data = rawData;
      if (typeof rawData === "string") { try { data = JSON.parse(rawData); } catch {} }
      if (error) {
        let msg = error.message || "Payment initiation failed";
        try {
          if ((error as any).context) {
            const body = await (error as any).context.json();
            msg = body?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not start payment");
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Cases</h1>
        <p className="text-muted-foreground mt-1">Track the status of your complaints</p>
      </div>

      <AppointmentSlotPicker complaintTable="complaints" userIdColumn="tenant_user_id" />

      {complaints.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No complaints filed yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Use "File Complaint" to report a tenancy violation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-bold text-card-foreground">{c.complaint_code}</span>
                    {c.ticket_number && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <Hash className="h-3 w-3" /> {c.ticket_number}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-card-foreground mt-1">{c.complaint_type}</h3>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusIcon[c.status]}
                  {statusLabel[c.status] || c.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Landlord: <span className="text-card-foreground font-medium">{c.landlord_name}</span></div>
                <div>Property: <span className="text-card-foreground font-medium">{c.property_address}</span></div>
                <div>Filed: <span className="text-card-foreground font-medium">{new Date(c.created_at).toLocaleDateString()}</span></div>
                <div>Updated: <span className="text-card-foreground font-medium">{new Date(c.updated_at).toLocaleDateString()}</span></div>
              </div>

              {/* Pay Now CTA when admin has requested payment */}
              {c.status === "pending_payment" && c.payment_status === "pending" && Number(c.outstanding_amount) > 0 && (
                <div className="mt-3 bg-warning/5 border border-warning/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CreditCard className="h-4 w-4 text-warning" /> Filing fee requested
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        An officer has set the fee for this complaint. Pay to proceed to scheduling.
                      </div>
                    </div>
                    <Button onClick={() => handlePayNow(c)} disabled={paying === c.id}>
                      {paying === c.id ? "Processing..." : "Pay Now"}
                    </Button>
                  </div>

                  {basketMap[c.id]?.length > 0 && (
                    <div className="bg-background border border-border rounded-md divide-y divide-border">
                      {basketMap[c.id].map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-foreground truncate">{it.label}</span>
                            {it.kind === "manual_adjustment" && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning shrink-0">Manual</span>
                            )}
                          </div>
                          <span className="font-medium text-foreground tabular-nums">GH₵ {Number(it.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-warning/30 pt-2">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground">GH₵ {Number(c.outstanding_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Paid receipt indicator */}
              {c.payment_status === "paid" && (
                <div className="mt-3 bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-success" />
                  <span className="text-foreground"><strong>Filing fee paid.</strong> Your complaint is ready for scheduling.</span>
                </div>
              )}


              {scheduleMap[c.id] && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" /> Appointment
                  </div>
                  {scheduleMap[c.id].status === "confirmed" && scheduleMap[c.id].selected_slot ? (
                    <div className="text-sm mt-1">
                      <span className="font-medium text-foreground">
                        {new Date(scheduleMap[c.id].selected_slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </span>{" "}
                      <span className="text-muted-foreground">{scheduleMap[c.id].selected_slot.time_start} — {scheduleMap[c.id].selected_slot.time_end}</span>
                      <span className="ml-2 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Confirmed</span>
                    </div>
                  ) : (
                    <div className="text-sm mt-1 text-warning font-medium">Awaiting your slot selection (check above)</div>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCases;
