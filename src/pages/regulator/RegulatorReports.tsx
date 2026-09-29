import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { CASE_LABELS, REG_LABELS, fmtGHS, reconcile } from "@/lib/statReports";

const db = supabase as any;
const PAGE = 25;
type Perm = "view" | "export" | "consolidate" | "manage" | "configure";
const PERMS: Perm[] = ["view", "export", "consolidate", "manage", "configure"];

function useReportPerms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["report-perms", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: sa }, { data: rows }] = await Promise.all([
        db.rpc("is_super_admin", { _user_id: user!.id }),
        db.from("report_permissions").select("permission").eq("user_id", user!.id),
      ]);
      const set = new Set<string>((rows ?? []).map((r: any) => r.permission));
      return { superAdmin: !!sa, has: (p: Perm) => !!sa || set.has(p) };
    },
  });
}

const FIELDS: [string, string][] = [
  ...Object.entries(CASE_LABELS),
  ["recovered_landlords", "Recovered — Landlords (GHS)"], ["recovered_tenants", "Recovered — Tenants (GHS)"], ["total_recovered", "Total Recovered (GHS)"],
  ...Object.entries(REG_LABELS),
];

function flatten(rep: any) {
  const c = rep.report_case_statistics ?? {}; const r = rep.report_recovery_statistics ?? {}; const g = rep.report_registration_statistics ?? {};
  return { ...c, ...r, ...g };
}

function exportPdf(title: string, meta: string[], rows: [string, string | number][]) {
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text("Rent Control Ghana", 14, 16);
  doc.setFontSize(12); doc.text(title, 14, 24);
  doc.setFontSize(9); let y = 32;
  meta.forEach((m) => { doc.text(m, 14, y); y += 5; });
  y += 3;
  rows.forEach(([k, v]) => {
    if (y > 280) { doc.addPage(); y = 16; }
    doc.text(String(k), 14, y); doc.text(String(v), 150, y); y += 6;
  });
  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}

function ReportDetail({ id, canExport, canManage, onClose }: { id: string; canExport: boolean; canManage: boolean; onClose: () => void }) {
  const { data: rep } = useQuery({
    queryKey: ["stat-report", id],
    queryFn: async () => {
      const { data, error } = await db.from("statistical_reports")
        .select("*, report_case_statistics(*), report_recovery_statistics(*), report_registration_statistics(*), report_awareness_activity(*)")
        .eq("id", id).single();
      if (error) throw error;
      const { data: history } = await db.from("statistical_reports").select("id,report_code,revision_no,submitted_at,submitter_name,status")
        .eq("office_id", data.office_id).eq("reporting_period", data.reporting_period).eq("reporting_year", data.reporting_year).order("revision_no", { ascending: false });
      return { ...data, history };
    },
  });
  if (!rep) return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const f = flatten(rep);
  const radio = rep.report_awareness_activity.filter((a: any) => a.medium === "radio").map((a: any) => a.station_name).join(", ");
  const tv = rep.report_awareness_activity.filter((a: any) => a.medium === "tv").map((a: any) => a.station_name).join(", ");
  const rows: [string, string | number][] = [
    ...FIELDS.map(([k, l]) => [l, k.startsWith("recovered") || k === "total_recovered" ? fmtGHS(f[k]) : f[k] ?? 0] as [string, string | number]),
    ["Radio stations", radio || "—"], ["TV stations", tv || "—"],
  ];
  const meta = [`Report ID: ${rep.report_code}  (Revision ${rep.revision_no})`, `Office: ${rep.office_name}, ${rep.region}`, `Period: ${rep.reporting_period} ${rep.reporting_year}`,
    `Submitted by: ${rep.submitter_name} — ${rep.submitter_position}`, `Submitted: ${new Date(rep.submitted_at).toLocaleString()}${rep.is_late ? " (late)" : ""}`];
  const xlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Rent Control Ghana — Statistical Report"], ...meta.map((m) => [m]), [], ["Field", "Value"], ...rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Report"); XLSX.writeFile(wb, `${rep.report_code}.xlsx`);
  };
  const reopen = async () => {
    const reason = prompt("Reason for reopening?"); if (!reason) return;
    const { error } = await db.rpc("reopen_statistical_report", { p_report_id: id, p_reason: reason });
    error ? toast.error(error.message) : (toast.success("Report reopened"), onClose());
  };
  return (
    <div className="space-y-4 print-area">
      <div className="text-sm space-y-0.5">{meta.map((m) => <p key={m} className="text-muted-foreground">{m}</p>)}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t border-border pt-3">
        {rows.map(([k, v]) => <Fragment key={k}><span className="text-muted-foreground">{k}</span><span className="text-foreground tabular-nums">{v}</span></Fragment>)}
      </div>
      {rep.history.length > 1 && (
        <div className="border-t border-border pt-3 text-xs space-y-1">
          <p className="font-semibold text-foreground">Revision history</p>
          {rep.history.map((h: any) => <p key={h.id} className="text-muted-foreground">Rev {h.revision_no} · {h.report_code} · {h.submitter_name} · {new Date(h.submitted_at).toLocaleString()} · {h.status}</p>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        {canExport && <Button size="sm" variant="outline" onClick={() => exportPdf(`Statistical Report ${rep.report_code}`, meta, rows)}><Download className="h-4 w-4 mr-1" />PDF</Button>}
        {canExport && <Button size="sm" variant="outline" onClick={xlsx}><Download className="h-4 w-4 mr-1" />Excel</Button>}
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
        {canManage && rep.is_current && rep.status !== "reopened" && <Button size="sm" variant="outline" onClick={reopen}>Reopen</Button>}
      </div>
    </div>
  );
}

function IndividualReports({ canExport, canManage }: { canExport: boolean; canManage: boolean }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["stat-reports", page, search],
    queryFn: async () => {
      let q = db.from("statistical_reports").select("id,report_code,office_name,region,submitter_name,submitter_position,reporting_period,reporting_year,submitted_at,status,revision_no,is_late,report_case_statistics(*)", { count: "exact" })
        .eq("is_current", true).order("submitted_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (search.trim()) q = q.or(`report_code.ilike.%${search.trim()}%,office_name.ilike.%${search.trim()}%,region.ilike.%${search.trim()}%`);
      const { data, count, error } = await q; if (error) throw error; return { rows: data ?? [], count: count ?? 0 };
    },
  });
  return (
    <div className="space-y-3">
      <Input placeholder="Search report ID, office or region..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-sm" />
      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>{["Report ID", "Office", "Region", "Submitter", "Position", "Period", "Year", "Submitted", "Validation"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
            {data?.rows.map((r: any) => {
              const rc = reconcile(r.report_case_statistics ?? {}); const ok = rc.channel.ok && rc.gender.ok && rc.outcome.ok && rc.ag.ok;
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(r.id)}>
                  <td className="px-3 py-2 font-mono text-xs">{r.report_code}{r.revision_no > 1 && <Badge variant="secondary" className="ml-1">R{r.revision_no}</Badge>}</td>
                  <td className="px-3 py-2">{r.office_name}</td><td className="px-3 py-2">{r.region}</td>
                  <td className="px-3 py-2">{r.submitter_name}</td><td className="px-3 py-2">{r.submitter_position}</td>
                  <td className="px-3 py-2">{r.reporting_period}</td><td className="px-3 py-2">{r.reporting_year}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.submitted_at).toLocaleDateString()}{r.is_late && <Badge variant="outline" className="ml-1">Late</Badge>}</td>
                  <td className="px-3 py-2">{r.status === "reopened" ? <Badge variant="outline">Reopened</Badge> : <Badge variant={ok ? "default" : "destructive"}>{ok ? "Reconciled" : "Mismatch"}</Badge>}</td>
                </tr>
              );
            })}
            {data && data.rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No reports submitted yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{data?.count ?? 0} reports</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Statistical Report</DialogTitle></DialogHeader>
          {open && <ReportDetail id={open} canExport={canExport} canManage={canManage} onClose={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function rangeFor(preset: string, from: string, to: string): [string | null, string | null, number | null] {
  const now = new Date(); const d = (x: Date) => x.toISOString();
  const som = new Date(now.getFullYear(), now.getMonth(), 1);
  switch (preset) {
    case "week": { const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); s.setHours(0, 0, 0, 0); return [d(s), null, null]; }
    case "month": return [d(som), null, null];
    case "last_month": return [d(new Date(now.getFullYear(), now.getMonth() - 1, 1)), d(som), null];
    case "quarter": return [d(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), null, null];
    case "custom": return [from ? d(new Date(from)) : null, to ? d(new Date(new Date(to).getTime() + 86400000)) : null, null];
    default: return [null, null, null];
  }
}

const SUM_KEYS = ["reports", "total_cases", "digital", "manual", "tenant_male", "tenant_female", "landlord_male", "landlord_female", "settled", "struck_off", "withdrawn", "referred_court", "pending", "arrears", "absconded", "other_matters", "ag_landlords", "ag_tenants", "recovered_landlords", "recovered_tenants", "total_recovered", "inspections", "agreements_registered", "rent_cards_issued", "landlords_registered", "tenants_registered", "radio_engagements", "tv_engagements"];
const sumRows = (rows: any[]) => { const o: any = {}; SUM_KEYS.forEach((k) => (o[k] = rows.reduce((a, r) => a + Number(r[k] ?? 0), 0))); o.avg_sittings = rows.length ? (rows.reduce((a, r) => a + Number(r.avg_sittings ?? 0), 0) / rows.length).toFixed(2) : 0; return o; };

function Consolidated({ canExport }: { canExport: boolean }) {
  const [preset, setPreset] = useState("year");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [period, setPeriod] = useState("all");
  const [region, setRegion] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [view, setView] = useState<"office" | "region">("region");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stat-consolidated", preset, year, period, region, from, to],
    queryFn: async () => {
      const [f, t] = rangeFor(preset, from, to);
      const { data, error } = await db.rpc("consolidate_statistical_reports", {
        p_from: f, p_to: t, p_region: region === "all" ? null : region, p_office: null,
        p_period: period === "all" ? null : period, p_year: preset === "year" || preset === "previous" ? Number(year) : null,
      });
      if (error) throw error; return data ?? [];
    },
  });
  const regions = useMemo(() => [...new Set(rows.map((r: any) => r.region))] as string[], [rows]);
  const { data: allRegions = [] } = useQuery({ queryKey: ["stat-regions"], queryFn: async () => { const { data } = await db.rpc("consolidate_statistical_reports", { p_from: null, p_to: null, p_region: null, p_office: null, p_period: null, p_year: null }); return [...new Set((data ?? []).map((r: any) => r.region))] as string[]; } });
  const national = sumRows(rows);
  const byRegion = regions.map((rg) => ({ office_name: rg, region: rg, ...sumRows(rows.filter((r: any) => r.region === rg)) }));
  const table = view === "office" ? rows : byRegion;
  const rc = reconcile(national);
  const cols: [string, string][] = [["reports", "Reports"], ["total_cases", "Total Cases"], ["settled", "Settled"], ["pending", "Pending"], ["referred_court", "Court"], ["total_recovered", "Recovered"], ["rent_cards_issued", "Rent Cards"], ["inspections", "Inspections"]];
  const label = `Consolidated Report ${preset === "year" || preset === "previous" ? year : preset}${period !== "all" ? " " + period : ""}${region !== "all" ? " " + region : ""}`;
  const allRows: [string, string | number][] = [...FIELDS.map(([k, l]) => [l, k.includes("recovered") ? fmtGHS(national[k]) : k === "sittings_to_settle" ? national.avg_sittings : national[k] ?? 0] as [string, string | number])];

  const xlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[label], [], ["Field", "National Total"], ...allRows]), "National");
    const head = ["Region", "Office", ...SUM_KEYS, "avg_sittings"];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...byRegion.map((r: any) => [r.region, "", ...SUM_KEYS.map((k) => r[k]), r.avg_sittings])]), "By Region");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows.map((r: any) => [r.region, r.office_name, ...SUM_KEYS.map((k) => r[k]), r.avg_sittings])]), "By Office");
    XLSX.writeFile(wb, `${label.replace(/\s+/g, "_")}.xlsx`);
  };
  const pdf = () => exportPdf(label, [`Offices reporting: ${rows.length}`, `Generated: ${new Date().toLocaleString()}`],
    [...allRows, ["", ""], ["REGIONAL BREAKDOWN", ""], ...byRegion.map((r: any) => [`${r.region}`, `${r.total_cases} cases · ${fmtGHS(r.total_recovered)}`] as [string, string]),
     ["", ""], ["OFFICE BREAKDOWN", ""], ...rows.map((r: any) => [`${r.office_name} (${r.region})`, `${r.total_cases} cases · ${fmtGHS(r.total_recovered)}`] as [string, string])]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-card border border-border rounded-lg p-4">
        <div className="space-y-1"><Label className="text-xs">Range</Label>
          <Select value={preset} onValueChange={setPreset}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{[["week", "This Week"], ["month", "This Month"], ["last_month", "Last Month"], ["quarter", "This Quarter"], ["year", "Year"], ["previous", "Previous Years"], ["custom", "Custom Range"], ["all", "All time"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        {(preset === "year" || preset === "previous") && <div className="space-y-1"><Label className="text-xs">Reporting Year</Label><Input type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} /></div>}
        {preset === "custom" && <><div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></>}
        <div className="space-y-1"><Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{["all", "Q1", "Q2", "Q3", "Q4", "Annual"].map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All" : p}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Region</Label>
          <Select value={region} onValueChange={setRegion}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Offices</SelectItem>{allRegions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
        {canExport && <div className="flex gap-2 ml-auto"><Button size="sm" variant="outline" onClick={pdf}><Download className="h-4 w-4 mr-1" />PDF</Button><Button size="sm" variant="outline" onClick={xlsx}><Download className="h-4 w-4 mr-1" />Excel</Button></div>}
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Offices reporting", rows.length], ["National Total Cases", national.total_cases], ["National Recoveries", fmtGHS(national.total_recovered)], ["Cases Settled", national.settled]].map(([l, v]) => (
              <div key={l as string} className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold text-foreground">{v}</p></div>
            ))}
          </div>
          {!(rc.channel.ok && rc.gender.ok && rc.outcome.ok && rc.ag.ok) && <p className="text-sm text-destructive">Warning: consolidated figures do not reconcile — check individual reports.</p>}
          <div className="bg-card border border-border rounded-lg p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {allRows.map(([k, v]) => <Fragment key={k}><div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">{k}</span><span className="tabular-nums font-medium">{v}</span></div></Fragment>)}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={view === "region" ? "default" : "outline"} onClick={() => setView("region")}>Regional breakdown</Button>
            <Button size="sm" variant={view === "office" ? "default" : "outline"} onClick={() => setView("office")}>Office-by-office</Button>
          </div>
          <div className="border border-border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground text-left"><tr><th className="px-3 py-2">{view === "office" ? "Office" : "Region"}</th>{cols.map(([, l]) => <th key={l} className="px-3 py-2">{l}</th>)}</tr></thead>
              <tbody>
                {table.map((r: any) => <tr key={r.office_id ?? r.region} className="border-t border-border"><td className="px-3 py-2">{r.office_name}{view === "office" && <span className="text-xs text-muted-foreground"> · {r.region}</span>}</td>{cols.map(([k]) => <td key={k} className="px-3 py-2 tabular-nums">{k === "total_recovered" ? fmtGHS(r[k]) : r[k]}</td>)}</tr>)}
                {table.length === 0 && <tr><td colSpan={cols.length + 1} className="p-6 text-center text-muted-foreground">No reports in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AccessControl() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["report-access"],
    queryFn: async () => {
      const [{ data: staff }, { data: perms }] = await Promise.all([
        db.from("admin_staff").select("user_id, admin_type, profiles:user_id(full_name,email)").neq("admin_type", "super_admin"),
        db.from("report_permissions").select("user_id,permission"),
      ]);
      return { staff: staff ?? [], perms: perms ?? [] };
    },
  });
  const toggle = async (user_id: string, permission: Perm, on: boolean) => {
    const { error } = on ? await db.from("report_permissions").insert({ user_id, permission })
      : await db.from("report_permissions").delete().eq("user_id", user_id).eq("permission", permission);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["report-access"] });
  };
  return (
    <div className="border border-border rounded-lg overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground text-left"><tr><th className="px-3 py-2">Admin</th>{PERMS.map((p) => <th key={p} className="px-3 py-2 capitalize">{p}</th>)}</tr></thead>
        <tbody>
          {data?.staff.map((s: any) => (
            <tr key={s.user_id} className="border-t border-border">
              <td className="px-3 py-2">{s.profiles?.full_name || s.profiles?.email || s.user_id}</td>
              {PERMS.map((p) => { const on = data.perms.some((x: any) => x.user_id === s.user_id && x.permission === p); return <td key={p} className="px-3 py-2"><Switch checked={on} onCheckedChange={(v) => toggle(s.user_id, p, v)} /></td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Configuration() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ["report-config"], queryFn: async () => (await db.from("reporting_config").select("*").eq("id", 1).single()).data });
  const { data: offices = [] } = useQuery({
    queryKey: ["report-pins"],
    queryFn: async () => {
      const [{ data: st }, { data: offs }] = await Promise.all([db.rpc("list_office_report_pin_status"), db.from("offices").select("id,name,region").order("region")]);
      return (offs ?? []).map((o: any) => ({ ...o, ...(st ?? []).find((s: any) => s.office_id === o.id) }));
    },
  });
  const [local, setLocal] = useState<any>(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (cfg) setLocal({ ...cfg, periodsText: cfg.periods.join(", "), yearsText: cfg.open_years.join(", "), deadlinesText: JSON.stringify(cfg.deadlines) }); }, [cfg]);
  if (!local) return <Loader2 className="h-5 w-5 animate-spin" />;
  const save = async () => {
    let deadlines = {}; try { deadlines = JSON.parse(local.deadlinesText || "{}"); } catch { return toast.error("Deadlines must be valid JSON"); }
    const { error } = await db.from("reporting_config").update({
      periods: local.periodsText.split(",").map((s: string) => s.trim()).filter(Boolean),
      open_years: local.yearsText.split(",").map((s: string) => Number(s.trim())).filter(Boolean),
      submissions_open: local.submissions_open, require_pin: local.require_pin, accept_late: local.accept_late, deadlines, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    error ? toast.error(error.message) : (toast.success("Configuration saved"), qc.invalidateQueries({ queryKey: ["report-config"] }));
  };
  const setPin = async (office_id: string) => {
    const pin = prompt("Enter a new 4–8 digit PIN for this office"); if (!pin) return;
    const { error } = await db.rpc("set_office_report_pin", { p_office_id: office_id, p_pin: pin });
    error ? toast.error(error.message) : (toast.success("PIN updated"), qc.invalidateQueries({ queryKey: ["report-pins"] }));
  };
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4 grid sm:grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Reporting periods (comma separated)</Label><Input value={local.periodsText} onChange={(e) => setLocal({ ...local, periodsText: e.target.value })} /></div>
        <div className="space-y-1"><Label>Open reporting years</Label><Input value={local.yearsText} onChange={(e) => setLocal({ ...local, yearsText: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Submission deadlines</Label><Input value={local.deadlinesText} onChange={(e) => setLocal({ ...local, deadlinesText: e.target.value })} placeholder='{"2026-Q3":"2026-10-15"}' /><p className="text-xs text-muted-foreground">Format: {"{\"YEAR-PERIOD\": \"YYYY-MM-DD\"}"}</p></div>
        {[["submissions_open", "Report submission active"], ["require_pin", "Require office PIN"], ["accept_late", "Accept late reports"]].map(([k, l]) => (
          <div key={k} className="flex items-center justify-between"><Label>{l}</Label><Switch checked={local[k]} onCheckedChange={(v) => setLocal({ ...local, [k]: v })} /></div>
        ))}
        <div className="sm:col-span-2"><Button onClick={save}>Save configuration</Button></div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Office submission PINs</h3>
        <Input placeholder="Search office..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="border border-border rounded-lg bg-card divide-y divide-border max-h-96 overflow-y-auto">
          {offices.filter((o: any) => !q || `${o.name} ${o.region}`.toLowerCase().includes(q.toLowerCase())).map((o: any) => (
            <div key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{o.name} <span className="text-xs text-muted-foreground">· {o.region}</span></span>
              <div className="flex items-center gap-2">{o.has_pin ? <Badge>PIN set</Badge> : <Badge variant="outline">No PIN</Badge>}<Button size="sm" variant="outline" onClick={() => setPin(o.id)}>{o.has_pin ? "Reset" : "Set"} PIN</Button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegulatorReports() {
  const { data: perms, isLoading } = useReportPerms();
  if (isLoading) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!perms?.has("view")) return <div className="p-8 text-muted-foreground">You do not have access to Reports. Ask a Super Admin to grant permission.</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold text-foreground">Statistical Reports</h1></div>
      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual Reports</TabsTrigger>
          {perms.has("consolidate") && <TabsTrigger value="consolidated">Consolidated</TabsTrigger>}
          {perms.superAdmin && <TabsTrigger value="access">Access</TabsTrigger>}
          {perms.has("configure") && <TabsTrigger value="config">Configuration</TabsTrigger>}
        </TabsList>
        <TabsContent value="individual"><IndividualReports canExport={perms.has("export")} canManage={perms.has("manage")} /></TabsContent>
        <TabsContent value="consolidated"><Consolidated canExport={perms.has("export")} /></TabsContent>
        <TabsContent value="access"><AccessControl /></TabsContent>
        <TabsContent value="config"><Configuration /></TabsContent>
      </Tabs>
    </div>
  );
}
