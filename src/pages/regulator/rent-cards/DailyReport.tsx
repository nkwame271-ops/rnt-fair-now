import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminProfile, GHANA_REGIONS, getOfficesForRegion, getRegionForOffice } from "@/hooks/useAdminProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  profile: AdminProfile | null;
  refreshKey: number;
}

interface DailyStats {
  openingPairs: number;
  assignedToday: number;
  soldToday: number;
  spoiltToday: number;
  closingPairs: number;
}

const DailyReport = ({ profile }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState(profile?.officeId || "");
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isMain = !profile || profile.isMainAdmin;
  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);
  const officeName = selectedOffice?.name || "";

  useEffect(() => {
    if (profile && !profile.isMainAdmin && profile.officeId) {
      setSelectedOfficeId(profile.officeId);
      const region = getRegionForOffice(profile.officeId);
      if (region) setSelectedRegion(region);
    }
  }, [profile]);

  const generateReport = async () => {
    if (!officeName) { toast.error("Select an office first"); return; }
    setLoading(true);
    setSubmitted(false);

    try {
      const officeRegion = selectedOfficeId ? getRegionForOffice(selectedOfficeId) : null;
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      // Fetch all serials for office (office stock only)
      let allSerials: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("rent_card_serial_stock")
          .select("serial_number, status, assigned_at, created_at, pair_index")
          .eq("office_name", officeName)
          .eq("stock_type", "office")
          .order("serial_number", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allSerials = allSerials.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // For pairs: count distinct serial_numbers
      const uniqueAvailable = new Set(allSerials.filter(s => s.status === "available").map(s => s.serial_number)).size;
      const uniqueSpoilt = new Set(allSerials.filter(s => s.status === "spoilt").map(s => s.serial_number)).size;
      const uniqueAssignedToday = new Set(
        allSerials.filter(s => s.status === "assigned" && s.assigned_at && s.assigned_at >= todayStart && s.assigned_at < todayEnd)
          .map(s => s.serial_number)
      ).size;

      // Opening = available + assigned today (what was available at start of day)
      const openingPairs = uniqueAvailable + uniqueAssignedToday;

      setStats({
        openingPairs,
        assignedToday: uniqueAssignedToday,
        soldToday: uniqueAssignedToday, // Sold = assigned in context of rent cards
        spoiltToday: uniqueSpoilt,
        closingPairs: uniqueAvailable,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    }
    setLoading(false);
  };

  const submitReport = async () => {
    if (!stats || !signedName.trim()) {
      toast.error("Please sign off by entering your full name");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("daily_stock_reports" as any).insert({
        office_id: selectedOfficeId,
        office_name: officeName,
        staff_user_id: "",
        staff_name: signedName,
        report_date: new Date().toISOString().split("T")[0],
        opening_pairs: stats.openingPairs,
        assigned_today: stats.assignedToday,
        sold_today: stats.soldToday,
        spoilt_today: stats.spoiltToday,
        closing_pairs: stats.closingPairs,
        notes: notes || null,
        signed_name: signedName,
      });
      if (error) throw error;
      toast.success("Daily report submitted and signed off!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Daily Rent Card Report
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate an automated daily report based on system activity. All values are auto-calculated.
        </p>

        <div className="flex items-end gap-4 flex-wrap">
          {isMain ? (
            <>
              <div className="space-y-2 flex-1 min-w-[180px]">
                <Label>Region</Label>
                <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedOfficeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRegion && (
                <div className="space-y-2 flex-1 min-w-[180px]">
                  <Label>Office</Label>
                  <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                    <SelectContent>
                      {regionOffices.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Office</Label>
              <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted/30">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-card-foreground">{officeName || "No office assigned"}</span>
              </div>
            </div>
          )}
        </div>

        <Button onClick={generateReport} disabled={loading || !officeName}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Compiling...</> : <><FileText className="h-4 w-4 mr-1" /> Generate Daily Report</>}
        </Button>

        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{stats.openingPairs}</p>
                <p className="text-xs text-muted-foreground">Opening Rent Card Pairs</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xl font-bold text-primary">{stats.assignedToday}</p>
                <p className="text-xs text-muted-foreground">Assigned Today</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
                <p className="text-xl font-bold text-success">{stats.soldToday}</p>
                <p className="text-xs text-muted-foreground">Sold Today</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xl font-bold text-destructive">{stats.spoiltToday}</p>
                <p className="text-xs text-muted-foreground">Spoilt</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{stats.closingPairs}</p>
                <p className="text-xs text-muted-foreground">Closing Rent Card Pairs</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 space-y-2 text-xs text-muted-foreground">
              <p><strong>Staff:</strong> {profile?.officeName || "—"}</p>
              <p><strong>Office:</strong> {officeName} ({selectedOfficeId})</p>
              <p><strong>Date:</strong> {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>

            {!submitted && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes about today's activity..." />
                </div>
                <div className="space-y-2">
                  <Label>Sign Off — Type your full name</Label>
                  <Input value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Enter your full name to sign off..." />
                </div>
                <Button onClick={submitReport} disabled={submitting || !signedName.trim()}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Submitting...</> : <><CheckCircle className="h-4 w-4 mr-1" /> Submit & Sign Off</>}
                </Button>
              </div>
            )}

            {submitted && (
              <div className="flex items-center gap-2 text-success bg-success/10 border border-success/20 rounded-lg p-3">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Report submitted and signed off successfully.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReport;
