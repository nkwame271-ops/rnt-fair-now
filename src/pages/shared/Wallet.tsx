import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Plus, Link2, RefreshCw, CheckCircle2, Trash2, QrCode, Copy } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";
import SensitiveActionGate from "@/components/SensitiveActionGate";


type WalletRow = {
  id: string;
  available_balance: number;
  escrow_balance: number;
  pending_balance: number;
  reserved_balance: number;
  total_received: number;
  total_withdrawn: number;
  currency: string;
};

const gh = (n: number) => `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingRef = useRef<null | (() => Promise<void> | void)>(null);
  const runWithGate = useCallback((fn: () => Promise<void> | void) => {
    pendingRef.current = fn;
    setGateOpen(true);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [w, e, a, l, ps] = await Promise.all([
      (supabase as any).from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("wallet_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("wallet_payout_accounts").select("*").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: false }),
      (supabase as any).from("wallet_payment_links").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("landlord_payment_settings").select("*").eq("landlord_user_id", user.id).maybeSingle(),
    ]);
    setWallet(w.data || null);
    setEntries(e.data || []);
    let acctRows = a.data || [];
    // Fallback: derive a virtual payout account from landlord_payment_settings
    // so the Withdraw dialog stops saying "Add a payout account first" when
    // a landlord has already saved payout details on their Payment Settings page.
    if (acctRows.length === 0 && ps?.data) {
      const s: any = ps.data;
      if (s.payment_method === "momo" && s.momo_number) {
        acctRows = [{
          id: `settings:momo:${user.id}`,
          account_type: "mobile_money",
          provider_code: s.momo_provider || "MTN",
          provider_name: s.momo_provider || "Mobile Money",
          account_number: s.momo_number,
          account_name: (user as any)?.user_metadata?.full_name || (user.email || "Wallet holder"),
          is_verified: true,
          is_default: true,
          active: true,
          from_settings: true,
        }];
      } else if (s.payment_method === "bank" && s.account_number) {
        acctRows = [{
          id: `settings:bank:${user.id}`,
          account_type: "bank",
          provider_code: s.bank_name || "BANK",
          provider_name: s.bank_name || "Bank",
          account_number: s.account_number,
          account_name: s.account_name || "Wallet holder",
          is_verified: true,
          is_default: true,
          active: true,
          from_settings: true,
        }];
      }
    }
    setAccounts(acctRows);
    setLinks(l.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <Seo title="NAFLIS Wallet | Rent Control" description="Manage your wallet balances, transactions, payout accounts, and payment links." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" /> NAFLIS Wallet
          </h1>
          <p className="text-muted-foreground mt-1">Your unified wallet for rent, escrow, and payouts.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BalanceCard label="Available" value={wallet?.available_balance || 0} highlight />
        <BalanceCard label="Rent Escrow" value={wallet?.escrow_balance || 0} />
        <BalanceCard label="Pending" value={wallet?.pending_balance || 0} />
        <BalanceCard label="Reserved / Disputed" value={wallet?.reserved_balance || 0} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button className="h-16 rounded-2xl text-base" onClick={() => setAddOpen(true)}>
          <ArrowDownToLine className="mr-2" /> Add Money
        </Button>
        <Button variant="outline" className="h-16 rounded-2xl text-base" onClick={() => setWdOpen(true)}>
          <ArrowUpFromLine className="mr-2" /> Withdraw
        </Button>
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Payout Accounts</TabsTrigger>
          <TabsTrigger value="links">Payment Links</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <EmptyBox text="No transactions yet." />
          ) : entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{e.description || e.entry_type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(e.created_at).toLocaleString()} · {e.entry_type} · {e.bucket}
                </p>
              </div>
              <div className={`font-bold ${e.direction === "credit" ? "text-primary" : "text-destructive"}`}>
                {e.direction === "credit" ? "+" : "−"} {gh(e.amount)}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">Totals — Received: {gh(wallet?.total_received || 0)} · Withdrawn: {gh(wallet?.total_withdrawn || 0)}</p>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4 space-y-2">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAcctOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Account</Button>
          </div>
          {accounts.length === 0 ? (
            <EmptyBox text="No payout accounts yet. Add mobile money or a bank account to withdraw." />
          ) : accounts.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{a.account_name}</p>
                  {a.is_default && <Badge variant="secondary">Default</Badge>}
                  {a.is_verified && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.account_type === "bank" ? "Bank" : "Mobile Money"} · {a.provider_name || a.provider_code} · {a.account_number}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => {
                if (!confirm("Remove this payout account?")) return;
                await (supabase as any).from("wallet_payout_accounts").update({ active: false }).eq("id", a.id);
                load();
              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="links" className="mt-4 space-y-2">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setLinkOpen(true)}><Plus className="mr-1 h-4 w-4" />New Link</Button>
          </div>
          {links.length === 0 ? (
            <EmptyBox text="No payment links yet. Create one to share for tenants or clients to pay you." />
          ) : links.map((l) => (
            <PaymentLinkRow key={l.id} link={l} onChange={load} />
          ))}
        </TabsContent>
      </Tabs>

      <AddMoneyDialog open={addOpen} onOpenChange={setAddOpen} email={user?.email || ""} onDone={load} />
      <WithdrawDialog open={wdOpen} onOpenChange={setWdOpen} accounts={accounts} balance={wallet?.available_balance || 0} onDone={load} requireConfirm={runWithGate} />
      <AddAccountDialog open={acctOpen} onOpenChange={setAcctOpen} onDone={load} requireConfirm={runWithGate} />
      <NewLinkDialog open={linkOpen} onOpenChange={setLinkOpen} onDone={load} />

      <SensitiveActionGate
        open={gateOpen}
        onOpenChange={(v) => { setGateOpen(v); if (!v) pendingRef.current = null; }}
        title="Confirm sensitive change"
        description="Wallet payout and withdrawal actions require password + OTP for your security."
        actionLabel="Confirm"
        onVerified={async () => { const fn = pendingRef.current; pendingRef.current = null; if (fn) await fn(); }}
      />
    </div>
  );
}


function BalanceCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
      <p className={`text-[10px] uppercase tracking-widest font-semibold ${highlight ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
      <p className="text-xl md:text-2xl font-extrabold mt-2">{gh(value)}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function AddMoneyDialog({ open, onOpenChange, email, onDone }: any) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Money to Wallet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (GHS)</Label>
            <Input type="number" min={1} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <p className="text-xs text-muted-foreground">You will be taken to a secure checkout to pay by card, mobile money, or bank.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !Number(amount)} onClick={async () => {
            setBusy(true);
            try {
              const { data, error } = await supabase.functions.invoke("wallet-topup", {
                body: { amount: Number(amount), payer_email: email, description: "Wallet top-up" },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any).error);
              onOpenChange(false);
              startBrandedCheckout({
                ...(data as any),
                confirmationPath: "/wallet/confirm",
                callbackPath: window.location.pathname,
              });
              setTimeout(onDone, 500);
            } catch (e: any) {
              toast.error(e.message || "Could not start payment");
            } finally { setBusy(false); }
          }}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ open, onOpenChange, accounts, balance, onDone, requireConfirm }: any) {
  const [amount, setAmount] = useState("");
  const [acctId, setAcctId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { const def = accounts.find((a: any) => a.is_default) || accounts[0]; if (def) setAcctId(def.id); } }, [open, accounts]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Withdraw to Payout Account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Available balance: <strong>{gh(balance)}</strong></p>
          {accounts.length === 0 ? (
            <p className="text-sm text-destructive">Add a payout account first.</p>
          ) : (
            <>
              <div>
                <Label>Payout Account</Label>
                <Select value={acctId} onValueChange={setAcctId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name} · {a.account_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (GHS)</Label>
                <Input type="number" min={1} max={balance} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !acctId || !Number(amount) || Number(amount) > balance} onClick={async () => {
            setBusy(true);
            try {
              let effectiveAcctId = acctId;
              const chosen = accounts.find((x: any) => x.id === acctId);
              if (chosen?.from_settings) {
                // Auto-provision a real wallet_payout_accounts row from Payment Settings.
                const { data: prov, error: pErr } = await supabase.functions.invoke("wallet-add-payout-account", {
                  body: {
                    account_type: chosen.account_type,
                    provider_code: chosen.provider_code,
                    provider_name: chosen.provider_name,
                    account_number: chosen.account_number,
                    account_name: chosen.account_name,
                  },
                });
                if (pErr) throw pErr;
                if ((prov as any)?.error) throw new Error((prov as any).error);
                effectiveAcctId = (prov as any)?.id;
                if (!effectiveAcctId) throw new Error("Could not activate payout account. Please add one manually.");
              }
              const { data, error } = await supabase.functions.invoke("wallet-withdraw", {
                body: { amount: Number(amount), payout_account_id: effectiveAcctId },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any).error);
              toast.success("Withdrawal initiated");
              onOpenChange(false);
              onDone();
            } catch (e: any) {
              toast.error(e.message || "Withdrawal failed");
            } finally { setBusy(false); }
          }}>Withdraw</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAccountDialog({ open, onOpenChange, onDone }: any) {
  const [type, setType] = useState<"mobile_money" | "bank">("mobile_money");
  const [banks, setBanks] = useState<any[]>([]);
  const [momo, setMomo] = useState<any[]>([]);
  const [providerCode, setProviderCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.functions.invoke("wallet-list-banks", { body: {} });
      setBanks((data as any)?.banks || []);
      setMomo((data as any)?.mobile_money || []);
    })();
  }, [open]);
  const providers = type === "bank" ? banks : momo;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Payout Account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Account Type</Label>
            <Select value={type} onValueChange={(v: any) => { setType(v); setProviderCode(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank">Bank Account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{type === "bank" ? "Bank" : "Network"}</Label>
            <Select value={providerCode} onValueChange={setProviderCode}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {providers.map((p: any) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{type === "bank" ? "Account Number" : "Mobile Number"}</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          {type === "mobile_money" && (
            <div>
              <Label>Account Name (as registered)</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !providerCode || !accountNumber || (type === "mobile_money" && !accountName)} onClick={async () => {
            setBusy(true);
            try {
              const provider = providers.find((p: any) => p.code === providerCode);
              const { data, error } = await supabase.functions.invoke("wallet-add-payout-account", {
                body: {
                  account_type: type,
                  provider_code: providerCode,
                  provider_name: provider?.name,
                  account_number: accountNumber,
                  account_name: accountName || undefined,
                },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any).error);
              toast.success("Payout account added");
              onOpenChange(false);
              setAccountNumber(""); setAccountName(""); setProviderCode("");
              onDone();
            } catch (e: any) {
              toast.error(e.message || "Could not add account");
            } finally { setBusy(false); }
          }}>Verify & Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLinkDialog({ open, onOpenChange, onDone }: any) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Payment Link</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. January Rent" /></div>
          <div><Label>Amount (GHS, leave blank for open)</Label><Input type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !title} onClick={async () => {
            setBusy(true);
            try {
              const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) + "-" + Math.random().toString(36).slice(2, 6));
              const { data: u } = await supabase.auth.getUser();
              const { error } = await (supabase as any).from("wallet_payment_links").insert({
                user_id: u.user?.id,
                slug,
                title,
                amount: amount ? Number(amount) : null,
                fixed_amount: !!amount,
              });
              if (error) throw error;
              toast.success("Link created");
              onOpenChange(false); setTitle(""); setAmount("");
              onDone();
            } catch (e: any) {
              toast.error(e.message || "Could not create link");
            } finally { setBusy(false); }
          }}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentLinkRow({ link, onChange }: any) {
  const url = `${window.location.origin}/pay/${link.slug}`;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{link.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{url}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {link.amount ? gh(link.amount) : "Open amount"} · Collected {gh(link.total_collected)} ({link.payment_count} payments)
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=300x300`, "_blank")}>
            <QrCode className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={async () => {
            await (supabase as any).from("wallet_payment_links").update({ active: !link.active }).eq("id", link.id);
            onChange();
          }}><Link2 className={`h-4 w-4 ${link.active ? "text-primary" : "text-muted-foreground"}`} /></Button>
        </div>
      </div>
    </div>
  );
}
