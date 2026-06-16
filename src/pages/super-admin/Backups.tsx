import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CloudUpload, ExternalLink, ShieldCheck, Database, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type BackupLog = {
  id: string;
  triggered_by_email: string | null;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  drive_folder_name: string | null;
  drive_folder_url: string | null;
  total_rows: number;
  current_table: string | null;
  progress_percent: number;
  error_message: string | null;
  tables_included: string[];
};

const statusVariant: Record<BackupLog["status"], string> = {
  running: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

export default function Backups() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const activeLog = useMemo(() => logs.find((l) => l.status === "running"), [logs]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("system_backup_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Could not load backup history");
      return;
    }
    setLogs((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Poll while a backup is running
  useEffect(() => {
    if (!activeLog) return;
    const id = setInterval(fetchLogs, 2500);
    return () => clearInterval(id);
  }, [activeLog?.id]);

  const startBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-drive", { body: {} });
      if (error) {
        const msg = (error as any)?.context?.body ? await (error as any).context.text?.() : error.message;
        toast.error(msg || "Backup failed to start");
      } else {
        toast.success(`Backup started → ${data?.folder_name ?? "Google Drive"}`);
        fetchLogs();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed to start");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CloudUpload className="h-6 w-6 text-amber-500" />
            System Backups → Google Drive
          </h1>
          <p className="text-muted-foreground">
            One-click full backup of every tenant, landlord, rent card, property, complaint and financial record to your secure Google Drive.
          </p>
        </div>
        <Badge className="bg-amber-500 text-white">SUPER ADMIN</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Google Drive Connection</CardTitle>
            <CardDescription>Connect the company Google account that will receive backup folders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How to connect</AlertTitle>
              <AlertDescription>
                Ask your Lovable workspace admin to link the <strong>Google Drive</strong> app connector from
                <span className="font-mono"> Connectors → Google Drive → Connect</span>. Once linked, backups
                upload to that account's Drive. The connection is workspace-wide and only used by this page.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> One-Click Backup</CardTitle>
            <CardDescription>Exports every critical table to CSV in a timestamped Drive folder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              onClick={startBackup}
              disabled={running || !!activeLog}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              <CloudUpload className="h-5 w-5 mr-2" />
              {activeLog ? "Backup in progress…" : running ? "Starting…" : "Back Up Everything Now"}
            </Button>

            {activeLog && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{activeLog.current_table ? `Uploading ${activeLog.current_table}…` : "Preparing…"}</span>
                  <span>{activeLog.progress_percent}%</span>
                </div>
                <Progress value={activeLog.progress_percent} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Restore is a manual process</AlertTitle>
        <AlertDescription>
          Backups are CSV exports of every table. To restore, contact platform engineering with the
          Drive folder name — restores must be reviewed before overwriting live data.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>Last 50 runs</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">No backups yet. Click <strong>Back Up Everything Now</strong> to create your first one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>Drive folder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="font-medium">{new Date(log.started_at).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell className="text-sm">{log.triggered_by_email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusVariant[log.status]}>{log.status}</Badge>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{log.total_rows.toLocaleString()}</TableCell>
                    <TableCell>
                      {log.drive_folder_url ? (
                        <a href={log.drive_folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline">
                          {log.drive_folder_name} <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">{log.drive_folder_name ?? "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
