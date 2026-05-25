import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SAFETY_STATUS_LABELS, SEVERITY_COLORS } from "@/lib/safetyCategories";
import { Siren, Settings } from "lucide-react";
import { toast } from "sonner";

const SafetyEmergencyReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [tab, setTab] = useState("active");
  const [emergencyTypeFilter, setEmergencyTypeFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("safety_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setReports(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("safety_reports_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_reports" }, (payload) => {
        if (payload.eventType === "INSERT" && (payload.new as any).report_kind === "panic_emergency") {
          toast.error(`🚨 New PANIC: ${(payload.new as any).ticket_number}`, { duration: 10000 });
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = reports.filter((r) => {
    if (tab === "active" && !["submitted", "acknowledged", "under_review", "escalated"].includes(r.status)) return false;
    if (tab === "unacknowledged" && r.acknowledged_at) return false;
    if (tab === "unacknowledged" && r.status === "closed") return false;
    if (tab === "closed" && !["resolved", "closed", "false_alert"].includes(r.status)) return false;
    if (roleFilter !== "all" && r.user_role !== roleFilter) return false;
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    if (emergencyTypeFilter !== "all" && r.emergency_type !== emergencyTypeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const match =
        r.ticket_number?.toLowerCase().includes(s) ||
        r.user_name_snapshot?.toLowerCase().includes(s) ||
        r.user_phone_snapshot?.toLowerCase().includes(s) ||
        r.category?.toLowerCase().includes(s);
      if (!match) return false;
    }
    return true;
  });

  const counts = {
    active: reports.filter((r) => ["submitted", "acknowledged", "under_review", "escalated"].includes(r.status)).length,
    unacknowledged: reports.filter((r) => !r.acknowledged_at && r.status !== "closed").length,
    all: reports.length,
    closed: reports.filter((r) => ["resolved", "closed", "false_alert"].includes(r.status)).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Siren className="h-6 w-6 text-red-600" />
            Safety & Emergency Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Separate from normal complaints. Urgent safety matters require immediate action.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/regulator/safety/contacts")}>
          <Settings className="h-4 w-4 mr-1" /> Safety Contacts
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 flex gap-3 flex-wrap">
          <Input
            placeholder="Search ticket, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
              <SelectItem value="landlord">Landlord</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          <Select value={emergencyTypeFilter} onValueChange={setEmergencyTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Emergencies</SelectItem>
              <SelectItem value="police">Police</SelectItem>
              <SelectItem value="fire">Fire</SelectItem>
              <SelectItem value="health">Health / Ambulance</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="unacknowledged">Unacknowledged ({counts.unacknowledged})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({counts.closed})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.ticket_number}</TableCell>
                          <TableCell>
                            {r.report_kind === "panic_emergency" ? (
                              <Badge className="bg-red-600 text-white">🚨 PANIC</Badge>
                            ) : (
                              <Badge variant="outline">Report</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.user_name_snapshot ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.user_phone_snapshot ?? ""}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{r.user_role}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {r.category?.replace(/_/g, " ") ?? r.emergency_type ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={SEVERITY_COLORS[r.severity] ?? ""}>{r.severity}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{SAFETY_STATUS_LABELS[r.status] ?? r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => navigate(`/regulator/safety/${r.id}`)}>
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No reports.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SafetyEmergencyReports;
