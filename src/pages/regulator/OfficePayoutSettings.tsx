import { useState, useEffect } from "react";
import { Loader2, Save, Building2, Shield } from "lucide-react";
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

interface SettlementAccount {
  id?: string;
  account_type: string;
  payment_method: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  momo_number: string;
  momo_provider: string;
  paystack_subaccount_code: string; // kept for backward compat
  paystack_recipient_code: string;
}

const SETTLEMENT_TYPES = [
  { key: "igf", label: "IGF (Rent Control)" },
  { key: "admin", label: "Admin" },
  { key: "platform", label: "Platform" },
  { key: "gra", label: "GRA" },
];

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

  // Settlement accounts state
  const [settlementAccounts, setSettlementAccounts] = useState<SettlementAccount[]>([]);
  const [settlementEdits, setSettlementEdits] = useState<Record<string, Partial<SettlementAccount>>>({});
  const [savingSettlement, setSavingSettlement] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (isMainAdmin) {
        const { data } = await supabase.from("offices").select("id, name").order("name");
        setOffices(data || []);
        if (data && data.length > 0) setSelectedOffice(data[0].id);

        // Load settlement accounts
        const { data: settlements } = await supabase
          .from("system_settlement_accounts")
          .select("*");
        setSettlementAccounts((settlements as any[]) || []);
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

  const getSettlementEdit = (accountType: string) => {
    const existing = settlementAccounts.find(a => a.account_type === accountType);
    const edits = settlementEdits[accountType] || {};
    return {
      id: existing?.id,
      account_type: accountType,
      payment_method: edits.payment_method ?? existing?.payment_method ?? "bank",
      account_name: edits.account_name ?? existing?.account_name ?? "",
      bank_name: edits.bank_name ?? existing?.bank_name ?? "",
      account_number: edits.account_number ?? existing?.account_number ?? "",
      momo_number: edits.momo_number ?? existing?.momo_number ?? "",
      momo_provider: edits.momo_provider ?? existing?.momo_provider ?? "",
      paystack_subaccount_code: edits.paystack_subaccount_code ?? existing?.paystack_subaccount_code ?? "",
      paystack_recipient_code: edits.paystack_recipient_code ?? existing?.paystack_recipient_code ?? "",
    };
  };

  const updateSettlementField = (accountType: string, field: string, value: string) => {
    setSettlementEdits(prev => ({
      ...prev,
      [accountType]: { ...prev[accountType], [field]: value },
    }));
  };

  const handleSaveSettlement = async (accountType: string) => {
    setSavingSettlement(accountType);
    const data = getSettlementEdit(accountType);
    const payload = {
      account_type: accountType,
      payment_method: data.payment_method,
      account_name: data.account_name || null,
      bank_name: data.payment_method === "bank" ? data.bank_name || null : null,
      account_number: data.payment_method === "bank" ? data.account_number || null : null,
      momo_number: data.payment_method === "momo" ? data.momo_number || null : null,
      momo_provider: data.payment_method === "momo" ? data.momo_provider || null : null,
      paystack_subaccount_code: data.paystack_subaccount_code || null,
      paystack_recipient_code: data.paystack_recipient_code || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };

    if (data.id) {
      const { error } = await supabase.from("system_settlement_accounts").update(payload).eq("id", data.id);
      if (error) toast.error("Failed to update"); else {
        toast.success(`${accountType.toUpperCase()} account updated`);
        setSettlementAccounts(prev => prev.map(a => a.account_type === accountType ? { ...a, ...payload } as any : a));
        setSettlementEdits(prev => { const n = { ...prev }; delete n[accountType]; return n; });
      }
    } else {
      const { data: inserted, error } = await supabase.from("system_settlement_accounts").insert(payload).select().single();
      if (error) toast.error("Failed to save"); else {
        toast.success(`${accountType.toUpperCase()} account saved`);
        setSettlementAccounts(prev => [...prev, inserted as any]);
        setSettlementEdits(prev => { const n = { ...prev }; delete n[accountType]; return n; });
      }
    }
    setSavingSettlement(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7" /> Payout Settings</h1>
        <p className="text-muted-foreground mt-1">Configure payout accounts for office fund withdrawals and system settlements</p>
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
          <CardTitle className="text-lg">Office Payout Account</CardTitle>
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
            Save Office Account
          </Button>
        </CardContent>
      </Card>

      {/* System Settlement Accounts — Main Admin only */}
      {isMainAdmin && (
        <>
          <div className="pt-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> System Settlement Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure payout details for IGF, Admin, Platform, and GRA. These are for backend financial allocation and settlement only.
            </p>
          </div>

          {SETTLEMENT_TYPES.map(({ key, label }) => {
            const data = getSettlementEdit(key);
            const hasEdits = !!settlementEdits[key];
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-lg">{label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Payment Method</label>
                    <Select value={data.payment_method} onValueChange={v => updateSettlementField(key, "payment_method", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="momo">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Account Name</label>
                    <Input value={data.account_name} onChange={e => updateSettlementField(key, "account_name", e.target.value)} placeholder="Name on account" />
                  </div>

                  {data.payment_method === "momo" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground">Provider</label>
                        <Select value={data.momo_provider} onValueChange={v => updateSettlementField(key, "momo_provider", v)}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MTN">MTN</SelectItem>
                            <SelectItem value="Vodafone">Vodafone</SelectItem>
                            <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Number</label>
                        <Input value={data.momo_number} onChange={e => updateSettlementField(key, "momo_number", e.target.value)} placeholder="0XX XXX XXXX" />
                      </div>
                    </>
                  )}

                  {data.payment_method === "bank" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground">Bank Name</label>
                        <Input value={data.bank_name} onChange={e => updateSettlementField(key, "bank_name", e.target.value)} placeholder="e.g., GCB Bank" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Account Number</label>
                        <Input value={data.account_number} onChange={e => updateSettlementField(key, "account_number", e.target.value)} placeholder="Account number" />
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-border">
                    <label className="text-sm font-medium text-foreground">Paystack Recipient Code</label>
                    <Input value={data.paystack_recipient_code} onChange={e => updateSettlementField(key, "paystack_recipient_code", e.target.value)} placeholder="RCP_xxxxx" className="font-mono" />
                    <p className="text-xs text-muted-foreground mt-1">Auto-generated when first payout is triggered, or enter manually from Paystack dashboard</p>
                  </div>

                    <Button
                    disabled={savingSettlement === key}
                    variant={hasEdits ? "default" : "outline"}
                    className="w-full sm:w-auto"
                  >
                    {savingSettlement === key ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save {label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
};

export default OfficePayoutSettings;
