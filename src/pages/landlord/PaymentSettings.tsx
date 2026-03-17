import { useState, useEffect } from "react";
import { Loader2, Wallet, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PaymentSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState("momo");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState("MTN");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("landlord_payment_settings")
        .select("*")
        .eq("landlord_user_id", user.id)
        .maybeSingle();

      if (data) {
        setMethod(data.payment_method || "momo");
        setMomoNumber(data.momo_number || "");
        setMomoProvider(data.momo_provider || "MTN");
        setBankName(data.bank_name || "");
        setBankBranch(data.bank_branch || "");
        setAccountNumber(data.account_number || "");
        setAccountName(data.account_name || "");
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      landlord_user_id: user.id,
      payment_method: method,
      momo_number: method === "momo" ? momoNumber : null,
      momo_provider: method === "momo" ? momoProvider : null,
      bank_name: method === "bank" ? bankName : null,
      bank_branch: method === "bank" ? bankBranch : null,
      account_number: method === "bank" ? accountNumber : null,
      account_name: method === "bank" ? accountName : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("landlord_payment_settings")
      .upsert(payload, { onConflict: "landlord_user_id" });

    if (error) toast.error("Failed to save settings");
    else toast.success("Payment settings saved!");
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payment Settings</h1>
        <p className="text-muted-foreground mt-1">Set up how you receive rent payments</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Payout Method</h2>
        </div>

        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="momo">Mobile Money</SelectItem>
              <SelectItem value="bank">Bank Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {method === "momo" && (
          <>
            <div className="space-y-2">
              <Label>Mobile Money Provider</Label>
              <Select value={momoProvider} onValueChange={setMomoProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                  <SelectItem value="Vodafone">Vodafone Cash</SelectItem>
                  <SelectItem value="AirtelTigo">AirtelTigo Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mobile Money Number</Label>
              <Input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="024 XXX XXXX" />
            </div>
          </>
        )}

        {method === "bank" && (
          <>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. GCB Bank" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="e.g. Accra Main" />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on account" />
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Payment Settings"}
        </Button>
      </div>
    </div>
  );
};

export default PaymentSettings;
