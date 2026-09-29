import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Shield, CheckCircle2, AlertTriangle, Plus, X, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { CASE_LABELS, CaseStats, REG_LABELS, fmtGHS, reconcile } from "@/lib/statReports";

type Office = { id: string; name: string; region: string };
const STEPS = ["Details", "Cases Received", "Outcomes", "Recoveries & Activity", "Awareness & Timeline", "Review"];

const emptyCases: CaseStats = {
  total_cases: 0, digital: 0, manual: 0, tenant_male: 0, tenant_female: 0, landlord_male: 0, landlord_female: 0,
  settled: 0, struck_off: 0, withdrawn: 0, referred_court: 0, pending: 0, arrears: 0, absconded: 0, other_matters: 0,
  ag_landlords: 0, ag_tenants: 0, sittings_to_settle: 0,
};
const emptyReg = { inspections: 0, agreements_registered: 0, rent_cards_issued: 0, landlords_registered: 0, tenants_registered: 0, radio_engagements: 0, tv_engagements: 0 };

const NumField = ({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    <Input type="number" min={0} step={step} inputMode="decimal" value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
  </div>
);

const Check = ({ ok, label, sum, target }: { ok: boolean; label: string; sum: number; target: number }) => (
  <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 border ${ok ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
    {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
    <span className="flex-1">{label}</span>
    <span className="font-semibold tabular-nums">{sum} / {target}</span>
  </div>
);

const StationList = ({ label, items, setItems }: { label: string; items: string[]; setItems: (s: string[]) => void }) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    {items.map((s, i) => (
      <div key={i} className="flex gap-2">
        <Input value={s} maxLength={120} placeholder="Station name" onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />
        <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
      </div>
    ))}
    <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ""])}><Plus className="h-4 w-4 mr-1" /> Add station</Button>
  </div>
);

export default function StatisticalReportSubmit() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [offices, setOffices] = useState<Office[]>([]);
  const [config, setConfig] = useState<{ periods: string[]; open_years: number[]; submissions_open: boolean; require_pin: boolean } | null>(null);
  const [officeSearch, setOfficeSearch] = useState("");
  const [d, setD] = useState({ submitter_name: "", submitter_position: "", office_id: "", reporting_period: "", reporting_year: "", pin: "", website: "" });
  const [c, setC] = useState<CaseStats>(emptyCases);
  const [rec, setRec] = useState({ recovered_landlords: 0, recovered_tenants: 0 });
  const [reg, setReg] = useState(emptyReg);
  const [radio, setRadio] = useState<string[]>([""]);
  const [tv, setTv] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState<string | null>(null);
  const [done, setDone] = useState<{ report_code: string; revision_no: number; submitted_at: string; is_late: boolean } | null>(null);

  useEffect(() => {
    supabase.functions.invoke("submit-statistical-report", { body: { action: "bootstrap" } }).then(({ data, error }) => {
      if (error) { toast.error("Could not load offices. Please refresh."); return; }
      setOffices(data.offices); setConfig(data.config);
    });
  }, []);

  const r = reconcile(c);
  const office = offices.find((o) => o.id === d.office_id);
  const filteredOffices = useMemo(() => {
    const q = officeSearch.trim().toLowerCase();
    return q ? offices.filter((o) => o.name.toLowerCase().includes(q) || o.region.toLowerCase().includes(q)) : offices;
  }, [offices, officeSearch]);
  const totalRecovered = Number(rec.recovered_landlords) + Number(rec.recovered_tenants);

  const stepValid = (s: number) => {
    if (s === 0) return d.submitter_name.trim().length >= 2 && d.submitter_position.trim().length >= 2 && !!d.office_id && !!d.reporting_period && !!d.reporting_year && (!config?.require_pin || d.pin.length >= 4);
    if (s === 1) return r.channel.ok && r.gender.ok;
    if (s === 2) return r.outcome.ok && r.ag.ok;
    return true;
  };
  const setCase = (k: keyof CaseStats) => (v: number) => setC((p) => ({ ...p, [k]: v }));

  const submit = async (confirm = false) => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("submit-statistical-report", {
      body: {
        action: "submit", ...d, reporting_year: Number(d.reporting_year), confirm_revision: confirm,
        cases: c, recovery: rec, registration: reg,
        radio_stations: radio.filter((s) => s.trim()), tv_stations: tv.filter((s) => s.trim()),
      },
    });
    setSending(false);
    if (error) {
      let msg = "Submission failed.";
      try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* ignore */ }
      toast.error(msg); return;
    }
    if (data?.needs_revision_confirm) { setRevisionPrompt(data.existing_code); return; }
    setDone(data);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Report submitted</h1>
          <p className="text-muted-foreground text-sm">Keep this reference for your records.</p>
          <div className="bg-muted rounded-lg p-4 font-mono text-lg font-semibold text-foreground">{done.report_code}</div>
          <p className="text-xs text-muted-foreground">
            {office?.name} · {d.reporting_period} {d.reporting_year} · Revision {done.revision_no}<br />
            Submitted {new Date(done.submitted_at).toLocaleString()}{done.is_late ? " (late)" : ""}
          </p>
          <Button onClick={() => navigate("/")} className="w-full">Back to home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Submit Statistical Report — Rent Control Ghana" description="Office statistical report submission." canonicalPath="/reports" />
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <p className="font-bold text-foreground text-sm">Rent Control Ghana</p>
            <p className="text-xs text-muted-foreground">Office Statistical Report</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span><span className="font-medium text-foreground">{STEPS[step]}</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </div>

        {config && !config.submissions_open && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Report submission is currently closed.</div>
        )}

        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Full Name *</Label><Input maxLength={120} value={d.submitter_name} onChange={(e) => setD({ ...d, submitter_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Position / Designation *</Label><Input maxLength={120} value={d.submitter_position} onChange={(e) => setD({ ...d, submitter_position: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Office *</Label>
                <Input placeholder="Search office or region..." value={officeSearch} onChange={(e) => setOfficeSearch(e.target.value)} />
                <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {filteredOffices.map((o) => (
                    <button type="button" key={o.id} onClick={() => setD({ ...d, office_id: o.id })}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${d.office_id === o.id ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}>
                      {o.name} <span className="text-xs text-muted-foreground">· {o.region}</span>
                    </button>
                  ))}
                  {filteredOffices.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No offices found</p>}
                </div>
                {office && <p className="text-xs text-primary">Selected: {office.name}, {office.region}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Period *</Label>
                <Select value={d.reporting_period} onValueChange={(v) => setD({ ...d, reporting_period: v })}>
                  <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                  <SelectContent>{config?.periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Year *</Label>
                <Select value={d.reporting_year} onValueChange={(v) => setD({ ...d, reporting_year: v })}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>{config?.open_years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {config?.require_pin && (
                <div className="space-y-1.5">
                  <Label>Office Submission PIN *</Label>
                  <Input type="password" inputMode="numeric" maxLength={8} value={d.pin} onChange={(e) => setD({ ...d, pin: e.target.value.replace(/\D/g, "") })} />
                  <p className="text-xs text-muted-foreground">Provided to your office by the administrator.</p>
                </div>
              )}
              <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} />
            </div>
          )}

          {step === 1 && (
            <>
              <NumField label="Total Cases" value={c.total_cases} onChange={setCase("total_cases")} />
              <div className="grid sm:grid-cols-2 gap-4">
                <NumField label={CASE_LABELS.digital} value={c.digital} onChange={setCase("digital")} />
                <NumField label={CASE_LABELS.manual} value={c.manual} onChange={setCase("manual")} />
              </div>
              <Check ok={r.channel.ok} label="Digital + Manual = Total Cases" sum={r.channel.sum} target={c.total_cases} />
              <div className="grid sm:grid-cols-2 gap-4">
                {(["tenant_male", "tenant_female", "landlord_male", "landlord_female"] as const).map((k) => <NumField key={k} label={CASE_LABELS[k]} value={c[k]} onChange={setCase(k)} />)}
              </div>
              <Check ok={r.gender.ok} label="Tenant + Landlord cases = Total Cases" sum={r.gender.sum} target={c.total_cases} />
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">Total Cases: <span className="font-semibold text-foreground">{c.total_cases}</span></p>
              <div className="grid sm:grid-cols-2 gap-4">
                {(["settled", "struck_off", "withdrawn", "referred_court", "pending"] as const).map((k) => <NumField key={k} label={CASE_LABELS[k]} value={c[k]} onChange={setCase(k)} />)}
              </div>
              <Check ok={r.outcome.ok} label="Settled + Struck Off + Withdrawn + Court + Pending = Total Cases" sum={r.outcome.sum} target={c.total_cases} />
              <h3 className="font-semibold text-sm text-foreground pt-2">Classification</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {(["arrears", "absconded", "other_matters"] as const).map((k) => <NumField key={k} label={CASE_LABELS[k]} value={c[k]} onChange={setCase(k)} />)}
              </div>
              <h3 className="font-semibold text-sm text-foreground pt-2">Referred to Attorney General</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <NumField label="Landlords" value={c.ag_landlords} onChange={setCase("ag_landlords")} />
                <NumField label="Tenants" value={c.ag_tenants} onChange={setCase("ag_tenants")} />
              </div>
              <Check ok={r.ag.ok} label="AG Landlords + AG Tenants = Referred to Court" sum={r.ag.sum} target={c.referred_court} />
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <NumField label="Amount Recovered for Landlords (GHS)" step={0.01} value={rec.recovered_landlords} onChange={(v) => setRec({ ...rec, recovered_landlords: v })} />
                <NumField label="Amount Recovered for Tenants (GHS)" step={0.01} value={rec.recovered_tenants} onChange={(v) => setRec({ ...rec, recovered_tenants: v })} />
              </div>
              <div className="rounded-md bg-muted px-4 py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total Amount Recovered (calculated)</span>
                <span className="font-bold text-foreground">{fmtGHS(totalRecovered)}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {(["inspections", "agreements_registered", "rent_cards_issued", "landlords_registered", "tenants_registered"] as const).map((k) =>
                  <NumField key={k} label={REG_LABELS[k]} value={reg[k]} onChange={(v) => setReg({ ...reg, [k]: v })} />)}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="font-semibold text-sm text-foreground">Radio</h3>
              <NumField label="Number of radio engagements" value={reg.radio_engagements} onChange={(v) => setReg({ ...reg, radio_engagements: v })} />
              <StationList label="Radio station(s)" items={radio} setItems={setRadio} />
              <h3 className="font-semibold text-sm text-foreground pt-2">Television</h3>
              <NumField label="Number of TV engagements" value={reg.tv_engagements} onChange={(v) => setReg({ ...reg, tv_engagements: v })} />
              <StationList label="TV station(s)" items={tv} setItems={setTv} />
              <h3 className="font-semibold text-sm text-foreground pt-2">Timelines for Cases Settled</h3>
              <NumField label="Number of sittings / adjournments before settlement" step={0.1} value={c.sittings_to_settle} onChange={setCase("sittings_to_settle")} />
            </>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-muted-foreground">Submitter</p><p className="text-foreground">{d.submitter_name} — {d.submitter_position}</p>
                <p className="text-muted-foreground">Office</p><p className="text-foreground">{office?.name}, {office?.region}</p>
                <p className="text-muted-foreground">Period</p><p className="text-foreground">{d.reporting_period} {d.reporting_year}</p>
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-1">
                {(Object.keys(CASE_LABELS) as (keyof CaseStats)[]).map((k) => (<><p key={k} className="text-muted-foreground">{CASE_LABELS[k]}</p><p className="text-foreground tabular-nums">{c[k]}</p></>))}
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-1">
                <p className="text-muted-foreground">Recovered — Landlords</p><p>{fmtGHS(rec.recovered_landlords)}</p>
                <p className="text-muted-foreground">Recovered — Tenants</p><p>{fmtGHS(rec.recovered_tenants)}</p>
                <p className="text-muted-foreground font-semibold">Total Recovered</p><p className="font-semibold">{fmtGHS(totalRecovered)}</p>
                {Object.entries(REG_LABELS).map(([k, l]) => (<><p key={k} className="text-muted-foreground">{l}</p><p className="tabular-nums">{(reg as any)[k]}</p></>))}
                <p className="text-muted-foreground">Radio stations</p><p>{radio.filter(Boolean).join(", ") || "—"}</p>
                <p className="text-muted-foreground">TV stations</p><p>{tv.filter(Boolean).join(", ") || "—"}</p>
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => (step === 0 ? navigate("/") : setStep(step - 1))}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!stepValid(step)} onClick={() => setStep(step + 1)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button disabled={sending || !config?.submissions_open || ![0, 1, 2].every(stepValid)} onClick={() => submit(false)}>{sending ? "Submitting..." : "Submit Report"}</Button>
          )}
        </div>
      </main>

      <AlertDialog open={!!revisionPrompt} onOpenChange={(o) => !o && setRevisionPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A report already exists</AlertDialogTitle>
            <AlertDialogDescription>
              Report {revisionPrompt} was already submitted for this office and period. Submitting again will create a revision; the earlier version is kept in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRevisionPrompt(null); submit(true); }}>Submit revision</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
