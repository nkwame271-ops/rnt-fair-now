import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileText,
  Gavel,
  Plus,
  Search,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Inbox,
  FilePlus2,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_BADGE_CLASS, STAGE_LABELS } from "@/lib/complaintAudit";
import { cn } from "@/lib/utils";

type ComplaintRow = {
  id: string;
  complaint_code: string | null;
  ticket_number: string | null;
  complaint_type: string | null;
  status: string | null;
  current_stage: string | null;
  payment_status: string | null;
  region: string | null;
  office_id: string | null;
  created_at: string;
  last_activity_at: string | null;
  next_hearing_at: string | null;
  assigned_officer_user_id: string | null;
  created_by_user_id: string | null;
  landlord_name: string | null;
  placeholder_complainant_name: string | null;
  placeholder_respondent_name: string | null;
  tenant_user_id: string | null;
  respondent_user_id: string | null;
  complaint_title: string | null;
  case_kind: "complaint" | "landlord_complaint";
};

const PAGE_SIZE = 50;

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger" | "success" | "info";
  onClick?: () => void;
}) {
  const toneMap = {
    default: "bg-card border-border",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-rose-50 border-rose-200",
    success: "bg-emerald-50 border-emerald-200",
    info: "bg-blue-50 border-blue-200",
  };
  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        toneMap[tone],
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComplaintsCommandCenter() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");

  const since = useMemo(() => {
    const days = Number(dateRange);
    if (Number.isFinite(days) && days > 0) {
      return subDays(new Date(), days).toISOString();
    }
    return null;
  }, [dateRange]);

  // ---- Summary metrics (computed in a single fetch of recent cases) ----
  const { data: metrics } = useQuery({
    queryKey: ["complaint-cc-metrics"],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const countFor = async (filter: (q: any) => any) => {
        const q = supabase
          .from("complaints")
          .select("id", { count: "exact", head: true });
        const { count } = await filter(q);
        return count ?? 0;
      };

      const [
        draft,
        submitted,
        under_review,
        assigned,
        hearingsToday,
        adjourned,
        settled,
        decided,
        awaitingAssign,
        awaitingDocs,
      ] = await Promise.all([
        countFor((q) => q.eq("current_stage", "draft")),
        countFor((q) => q.eq("current_stage", "submitted")),
        countFor((q) => q.eq("current_stage", "under_review")),
        countFor((q) => q.eq("current_stage", "assigned")),
        countFor((q) =>
          q.gte("next_hearing_at", todayStart).lte("next_hearing_at", todayEnd),
        ),
        countFor((q) => q.eq("current_stage", "adjourned")),
        countFor((q) => q.eq("current_stage", "settled")),
        countFor((q) => q.eq("current_stage", "decided")),
        countFor((q) =>
          q.eq("current_stage", "submitted").is("assigned_officer_user_id", null),
        ),
        countFor((q) => q.eq("current_stage", "pending_documents")),
      ]);
      return {
        draft,
        submitted,
        under_review,
        assigned,
        hearingsToday,
        adjourned,
        settled,
        decided,
        awaitingAssign,
        awaitingDocs,
      };
    },
    staleTime: 60_000,
  });

  // ---- Case list ----
  const { data: rows = [], isLoading } = useQuery({
    queryKey: [
      "complaint-cc-list",
      search,
      stageFilter,
      typeFilter,
      regionFilter,
      since,
    ],
    queryFn: async () => {
      let q = supabase
        .from("complaints")
        .select(
          "id, complaint_code, ticket_number, complaint_type, status, current_stage, payment_status, region, office_id, created_at, last_activity_at, next_hearing_at, assigned_officer_user_id, created_by_user_id, landlord_name, placeholder_complainant_name, placeholder_respondent_name, tenant_user_id, respondent_user_id, complaint_title",
        )
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (stageFilter !== "all") q = q.eq("current_stage", stageFilter);
      if (typeFilter !== "all") q = q.eq("complaint_type", typeFilter);
      if (regionFilter !== "all") q = q.eq("region", regionFilter);
      if (since) q = q.gte("created_at", since);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(
          [
            `complaint_code.ilike.${s}`,
            `ticket_number.ilike.${s}`,
            `landlord_name.ilike.${s}`,
            `placeholder_complainant_name.ilike.${s}`,
            `placeholder_respondent_name.ilike.${s}`,
            `complaint_title.ilike.${s}`,
          ].join(","),
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ComplaintRow[];
    },
    staleTime: 30_000,
  });

  // ---- Distinct values for type/region filters (derived) ----
  const distinct = useMemo(() => {
    const types = new Set<string>();
    const regions = new Set<string>();
    rows.forEach((r) => {
      if (r.complaint_type) types.add(r.complaint_type);
      if (r.region) regions.add(r.region);
    });
    return { types: Array.from(types).sort(), regions: Array.from(regions).sort() };
  }, [rows]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Complaints Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track, assign, and resolve every complaint moving through the Rent Control case desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/regulator/complaints/new">
              <Plus className="h-4 w-4 mr-2" /> New Complaint
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/regulator/form-engine">
              <FilePlus2 className="h-4 w-4 mr-2" /> Form Templates
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Draft" value={metrics?.draft ?? "—"} icon={ClipboardList} onClick={() => setStageFilter("draft")} />
        <KpiCard label="Submitted" value={metrics?.submitted ?? "—"} icon={Inbox} tone="info" onClick={() => setStageFilter("submitted")} />
        <KpiCard label="Under Review" value={metrics?.under_review ?? "—"} icon={Eye} tone="info" onClick={() => setStageFilter("under_review")} />
        <KpiCard label="Assigned" value={metrics?.assigned ?? "—"} icon={UserCheck} onClick={() => setStageFilter("assigned")} />
        <KpiCard label="Hearings Today" value={metrics?.hearingsToday ?? "—"} icon={CalendarDays} tone="warning" />
        <KpiCard label="Adjourned" value={metrics?.adjourned ?? "—"} icon={PauseCircle} tone="warning" onClick={() => setStageFilter("adjourned")} />
        <KpiCard label="Settled" value={metrics?.settled ?? "—"} icon={CheckCircle2} tone="success" onClick={() => setStageFilter("settled")} />
        <KpiCard label="Decided" value={metrics?.decided ?? "—"} icon={Gavel} tone="success" onClick={() => setStageFilter("decided")} />
        <KpiCard label="Awaiting Assignment" value={metrics?.awaitingAssign ?? "—"} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Awaiting Documents" value={metrics?.awaitingDocs ?? "—"} icon={FileText} tone="warning" onClick={() => setStageFilter("pending_documents")} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by case ref, ticket, complainant, respondent, title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {distinct.types.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {distinct.regions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="md:w-40"><SelectValue placeholder="Date range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="0">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Case table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Cases ({rows.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Showing latest {PAGE_SIZE}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Case Ref</TableHead>
                  <TableHead className="whitespace-nowrap">Received</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Complainant</TableHead>
                  <TableHead>Respondent</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Hearing</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No cases match these filters.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const stage = (r.current_stage ?? r.status ?? "submitted").toLowerCase();
                  const complainant = r.placeholder_complainant_name ?? (r.tenant_user_id ? "Registered user" : "—");
                  const respondent = r.placeholder_respondent_name ?? r.landlord_name ?? "—";
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">
                        {r.complaint_code ?? r.ticket_number ?? r.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">{r.complaint_type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{complainant}</TableCell>
                      <TableCell className="text-sm">{respondent}</TableCell>
                      <TableCell className="text-xs">{r.region ?? "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.next_hearing_at ? format(new Date(r.next_hearing_at), "dd MMM, HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", STAGE_BADGE_CLASS[stage] ?? "")}
                        >
                          {STAGE_LABELS[stage] ?? stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.last_activity_at
                          ? formatDistanceToNow(new Date(r.last_activity_at), { addSuffix: true })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/regulator/complaints/${r.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
