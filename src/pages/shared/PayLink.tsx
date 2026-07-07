import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";

export default function PayLink() {
  const { slug } = useParams<{ slug: string }>();
  const [link, setLink] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("wallet_payment_links").select("*").eq("slug", slug).eq("active", true).maybeSingle();
      setLink(data);
      if (data?.amount) setAmount(String(data.amount));
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!link) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="pt-6 text-center text-sm text-muted-foreground">This payment link is not available.</CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Seo title={`Pay: ${link.title}`} description={`Secure payment for ${link.title}`} canonicalPath={`/pay/${slug}`} />
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary text-sm"><Wallet className="h-4 w-4" /> NAFLIS Secure Payment</div>
          <CardTitle className="mt-2">{link.title}</CardTitle>
          {link.description && <p className="text-sm text-muted-foreground mt-1">{link.description}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Your Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label>Amount (GHS)</Label>
            <Input type="number" step={0.01} min={1} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={link.fixed_amount} />
          </div>
          <Button className="w-full h-12" disabled={busy || !email || !Number(amount)} onClick={async () => {
            setBusy(true);
            try {
              const { data, error } = await supabase.functions.invoke("wallet-topup", {
                body: {
                  amount: Number(amount),
                  recipient_user_id: link.user_id,
                  payer_email: email,
                  payment_link_id: link.id,
                  description: link.title,
                },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any).error);
              startBrandedCheckout({
                ...(data as any),
                confirmationPath: "/wallet/confirm",
              });
            } catch (e: any) {
              toast.error(e.message || "Could not start payment");
            } finally { setBusy(false); }
          }}>Pay {amount ? `GHS ${Number(amount).toFixed(2)}` : ""}</Button>
          <p className="text-[10px] text-center text-muted-foreground">Payments are processed securely. You will receive a receipt by email.</p>
        </CardContent>
      </Card>
    </div>
  );
}
