import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Send, FileText } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";

const paymentTypes = [
  { value: "key_money", label: "Key Money" },
  { value: "goodwill", label: "Goodwill Fee" },
  { value: "extra_advance", label: "Extra Advance (beyond 6 months)" },
  { value: "other", label: "Other Illegal Charge" },
];

const ReportSidePayment = () => {
  const { user } = useAuth();
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [existing, setExisting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTenancy, setSelectedTenancy] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: t }, { data: decls }] = await Promise.all([
        supabase.from("tenancies").select("id, registration_code, agreed_rent, landlord_user_id").eq("tenant_user_id", user.id).in("status", ["active", "renewal_window", "pending"]),
        supabase.from("side_payment_declarations").select("*").eq("declared_by", user.id).order("created_at", { ascending: false }),
      ]);
      setTenancies(t || []);
      setExisting(decls || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!selectedTenancy || !paymentType || !amount || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("side_payment_declarations").insert({
        tenancy_id: selectedTenancy,
        declared_by: user!.id,
        amount: numAmount,
        payment_type: paymentType,
        description: description.trim(),
      });
      if (error) throw error;

      // Notify regulator(s) via a general notification
      const tenancy = tenancies.find(t => t.id === selectedTenancy);
      if (tenancy) {
        // Notify the landlord's side too
        await supabase.from("notifications").insert({
          user_id: tenancy.landlord_user_id,
          title: "Side-Payment Report Filed",
          body: `A tenant has reported an illegal side payment of GH₵${numAmount.toFixed(2)} against tenancy ${tenancy.registration_code}.`,
          link: "/landlord/agreements",
        });
      }

      toast.success("Side-payment declaration submitted");
      setSelectedTenancy("");
      setPaymentType("");
      setAmount("");
      setDescription("");
      const { data: decls } = await supabase.from("side_payment_declarations").select("*").eq("declared_by", user!.id).order("created_at", { ascending: false });
      setExisting(decls || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LogoLoader message="Loading..." />;

  const statusColor = (s: string) => {
    switch (s) {
      case "reported": return "bg-warning/10 text-warning";
      case "under_investigation": return "bg-info/10 text-info";
      case "confirmed": return "bg-destructive/10 text-destructive";
      case "dismissed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Report Side Payment
          </h1>
          <p className="text-muted-foreground text-sm">Report illegal charges such as key money, goodwill fees, or advance rent beyond 6 months as prohibited by Act 220.</p>
        </div>

        {tenancies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Declare Illegal Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Select Tenancy</label>
                <Select value={selectedTenancy} onValueChange={setSelectedTenancy}>
                  <SelectTrigger><SelectValue placeholder="Choose tenancy" /></SelectTrigger>
                  <SelectContent>
                    {tenancies.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.registration_code} — GH₵{t.agreed_rent}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Type of Payment</label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Amount (GH₵)</label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe when and how this payment was demanded or made..." rows={4} maxLength={2000} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full" variant="destructive">
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Declaration"}
              </Button>
            </CardContent>
          </Card>
        )}

        {tenancies.length === 0 && existing.length === 0 && (
          <EmptyState icon={FileText} title="No Tenancies" description="You need an active tenancy to report a side payment." />
        )}

        {existing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Declarations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {existing.map(d => (
                <div key={d.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {d.payment_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} — GH₵{Number(d.amount).toFixed(2)}
                    </span>
                    <Badge className={statusColor(d.status)}>{d.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{d.description}</p>
                  <p className="text-xs text-muted-foreground">Filed {format(new Date(d.created_at), "MMM d, yyyy")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
};

export default ReportSidePayment;
