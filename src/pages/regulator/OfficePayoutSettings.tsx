import { useState, useEffect } from "react";
import { Loader2, Save, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";

interface PayoutAccount {
  id?: string;
  office_id: string;
  payment_method: string;
  momo_number: string;
  momo_provider: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

const OfficePayoutSettings = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const isMainAdmin = profile?.isMainAdmin ?? false;
  const officeId = profile?.officeId ?? null;

  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("");
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [method, setMethod] = useState("momo");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (isMainAdmin) {
        const { data } = await supabase.from("offices").select("id, name").order("name");
        setOffices(data || []);
        if (data && data.length > 0) setSelectedOffice(data[0].id);
      } else if (officeId) {
        setSelectedOffice(officeId);
      }
      setLoading(false);
    };
    load();
  }, [isMainAdmin, officeId]);

  useEffect(() => {
    if (!selectedOffice) return;
    const fetchAccount = async () => {
      const { data } = await supabase
        .from("office_payout_accounts")
        .select("*")
        .eq("office_id", selectedOffice)
        .maybeSingle();

      if (data) {
        setAccount(data as any);
        setMethod((data as any).payment_method || "momo");
        setMomoNumber((data as any).momo_number || "");
        setMomoProvider((data as any).momo_provider || "");
        setBankName((data as any).bank_name || "");
        setAccountNumber((data as any).account_number || "");
        setAccountName((data as any).account_name || "");
      } else {
        setAccount(null);
        setMethod("momo");
        setMomoNumber("");
        setMomoProvider("");
        setBankName("");
        setAccountNumber("");
        setAccountName("");
      }
    };
    fetchAccount();
  }, [selectedOffice]);

  const handleSave = async () => {
    if (!selectedOffice) return;
    setSaving(true);

    const payload = {
      office_id: selectedOffice,
      payment_method: method,
      momo_number: method === "momo" ? momoNumber : null,
      momo_provider: method === "momo" ? momoProvider : null,
      bank_name: method === "bank" ? bankName : null,
      account_number: method === "bank" ? accountNumber : null,
      account_name: accountName || null,
      updated_at: new Date().toISOString(),
    };

    if (account?.id) {
      const { error } = await supabase.from("office_payout_accounts").update(payload).eq("id", account.id);
      if (error) toast.error("Failed to update"); else toast.success("Payout account updated");
    } else {
      const { error } = await supabase.from("office_payout_accounts").insert(payload);
      if (error) toast.error("Failed to save"); else toast.success("Payout account saved");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7" /> Office Payout Settings</h1>
        <p className="text-muted-foreground mt-1">Configure the payout account for office fund withdrawals</p>
      </div>

      {isMainAdmin && offices.length > 0 && (
        <div>
          <label className="text-sm font-medium text-foreground">Select Office</label>
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payout Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Payment Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="momo">Mobile Money</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Account Name</label>
            <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Name on account" />
          </div>

          {method === "momo" && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Mobile Money Provider</label>
                <Select value={momoProvider} onValueChange={setMomoProvider}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN">MTN</SelectItem>
                    <SelectItem value="Vodafone">Vodafone</SelectItem>
                    <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Mobile Money Number</label>
                <Input value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="0XX XXX XXXX" />
              </div>
            </>
          )}

          {method === "bank" && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Bank Name</label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g., GCB Bank" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Account Number</label>
                <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" />
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Payout Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfficePayoutSettings;
