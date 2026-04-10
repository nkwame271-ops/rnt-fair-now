import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface StaffRow {
  user_id: string;
  admin_type: string;
  office_name: string | null;
  full_name?: string;
  email?: string;
}

interface ActivityRow {
  id: string;
  user_id: string;
  event_type: string;
  event_detail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  source: "activity" | "audit";
  // For audit log entries
  action?: string;
  target_type?: string;
  reason?: string;
}

const EVENT_BADGE_STYLES: Record<string, string> = {
  login: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  navigation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  action: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const ActivityLogsTab = ({ staff }: { staff: StaffRow[] }) => {
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nameMap = new Map(staff.map(s => [s.user_id, { name: s.full_name || "Unknown", email: s.email || "" }]));

  const fetchLogs = async () => {
    setLoading(true);

    // Fetch both tables in parallel
    const [activityRes, auditRes] = await Promise.all([
      supabase
        .from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const activityRows: ActivityRow[] = (activityRes.data || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      event_type: r.event_type,
      event_detail: r.event_detail,
      metadata: r.metadata,
      created_at: r.created_at,
      source: "activity" as const,
    }));

    const auditRows: ActivityRow[] = (auditRes.data || []).map((r: any) => ({
      id: r.id,
      user_id: r.admin_user_id,
      event_type: "action",
      event_detail: `${r.action} on ${r.target_type}`,
      metadata: { reason: r.reason, old_state: r.old_state, new_state: r.new_state, target_id: r.target_id },
      created_at: r.created_at,
      source: "audit" as const,
      action: r.action,
      target_type: r.target_type,
      reason: r.reason,
    }));

    // Merge and sort by time
    const merged = [...activityRows, ...auditRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 500);

    setLogs(merged);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(log => {
    if (filterType !== "all" && log.event_type !== filterType) return false;
    if (filterUser !== "all" && log.user_id !== filterUser) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const detail = (log.event_detail || "").toLowerCase();
      const name = (nameMap.get(log.user_id)?.name || "").toLowerCase();
      if (!detail.includes(term) && !name.includes(term)) return false;
    }
    return true;
  });

  const getUserDisplay = (userId: string) => {
    const info = nameMap.get(userId);
    return info ? info.name : userId.substring(0, 8) + "...";
  };

  const getBrowserShort = (meta: Record<string, unknown> | null) => {
    if (!meta?.userAgent) return "—";
    const ua = meta.userAgent as string;
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return "Other";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/50 rounded-lg p-4 border border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by detail or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="navigation">Navigation</SelectItem>
            <SelectItem value="action">Action</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.user_id} value={s.user_id}>
                {s.full_name || s.user_id.substring(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {logs.length} entries
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No activity logs found. Logs will appear as admins use the platform.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[150px]">User</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="w-[80px]">Browser</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <>
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-foreground truncate max-w-[140px]">
                        {getUserDisplay(log.user_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_BADGE_STYLES[log.event_type] || "bg-muted text-muted-foreground"}`}>
                        {log.event_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-foreground truncate max-w-[300px]">
                      {log.event_detail || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {getBrowserShort(log.metadata)}
                    </TableCell>
                    <TableCell>
                      {expandedId === log.id ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <pre className="text-[10px] text-muted-foreground overflow-x-auto max-h-48 p-3 rounded font-mono whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
