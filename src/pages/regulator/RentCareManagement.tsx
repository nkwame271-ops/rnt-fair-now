import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { RENTCARE_STATUS_LABELS, RENTCARE_PROGRAMME_NAME } from "@/lib/rentcare/legalNotice";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";

const STATUS_OPTIONS = Object.keys(RENTCARE_STATUS_LABELS);

export default function RentCareManagement() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const { flags } = useAllFeatureFlags();
  const exportEnabled = flags.find((f) => f.feature_key === "rentcare_admin_export_enabled")?.is_enabled ?? false;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rentcare_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setApps(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    const { data, error } = await supabase.rpc("rentcare_admin_update", {
      p_application_id: selected.id,
      p_expected_version: selected.version,
      p_patch: { status: newStatus } as any,
    });
    if (error) { toast.error(error.message); return; }
    const result = data as any;
    if (result?.ok === false) {
      toast.error("Someone else updated this application. Refresh and try again.");
      load();
      return;
    }
    toast.success("Status updated.");
    setSelected(null);
    load();
  };

  const exportCsv = () => {
    const cols = ["reference","full_name","phone","institution","student_id_code","provider_name","amount_requested","payment_status","payment_reference","umb_account_name","umb_account_number","status","submitted_at"];
    const lines = [cols.join(",")];
    apps.forEach((a) => {
      lines.push(cols.map((c) => JSON.stringify(a[c] ?? "")).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `rentcare_applications_${Date.now()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = apps.filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">RentCare Assistance Management</h1>
          <p className="text-sm text-muted-foreground">{RENTCARE_PROGRAMME_NAME}</p>
        </div>
        {exportEnabled && (
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {STATUS_OPTIONS.filter((s) => counts[s] > 0).map((s) => (
          <Card key={s}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{RENTCARE_STATUS_LABELS[s]}</div>
            <div className="text-xl font-bold">{counts[s]}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Applications ({apps.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Reference</th><th>Applicant</th><th>Institution</th><th>Requested</th><th>Payment</th><th>Status</th><th>UMB</th><th></th></tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2 font-mono text-xs">{a.reference}</td>
                  <td>{a.full_name || "—"}</td>
                  <td>{a.institution || "—"}</td>
                  <td>GHS {Number(a.amount_requested || 0).toLocaleString()}</td>
                  <td><Badge variant="outline">{a.payment_status}</Badge></td>
                  <td><Badge>{RENTCARE_STATUS_LABELS[a.status] || a.status}</Badge></td>
                  <td className="text-xs">{a.umb_account_number ? "✓" : "—"}</td>
                  <td><Button size="sm" variant="outline" onClick={() => setSelected(a)}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{selected.reference} — {selected.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>Phone: {selected.phone}</div>
              <div>Email: {selected.email}</div>
              <div>Ghana Card: {selected.ghana_card_no}</div>
              <div>Institution: {selected.institution} ({selected.student_id_code})</div>
              <div>Provider: {selected.provider_name}</div>
              <div>Requested: GHS {Number(selected.amount_requested || 0).toLocaleString()}</div>
              <div>Payment ref: {selected.payment_reference || "—"}</div>
              <div>UMB: {selected.umb_account_name} / {selected.umb_account_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Update Status</div>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"} onClick={() => updateStatus(s)}>
                    {RENTCARE_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
