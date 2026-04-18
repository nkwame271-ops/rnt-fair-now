import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const severityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  warning: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-700 border-blue-500/30",
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const PaymentErrors = () => {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [selectedError, setSelectedError] = useState<any>(null);

  const { data: errors, isLoading } = useQuery({
    queryKey: ["payment-errors", severityFilter, resolvedFilter],
    queryFn: async () => {
      let query = supabase
        .from("payment_processing_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (severityFilter !== "all") query = query.eq("severity", severityFilter);
      if (resolvedFilter === "unresolved") query = query.eq("resolved", false);
      else if (resolvedFilter === "resolved") query = query.eq("resolved", true);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_processing_errors")
        .update({ resolved: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-errors"] });
      toast.success("Marked as resolved");
    },
  });

  const unresolvedCritical = errors?.filter(e => !e.resolved && e.severity === "critical").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payment Error Log</h1>
          <p className="text-sm text-muted-foreground">Monitor and resolve payment processing errors</p>
        </div>
        {unresolvedCritical > 0 && (
          <Badge className="bg-destructive text-destructive-foreground">
            {unresolvedCritical} critical unresolved
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-center text-muted-foreground">Loading...</p>
          ) : !errors?.length ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="text-muted-foreground">No errors found</p>
            </div>
          ) : (
            <div className="responsive-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Function</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden md:table-cell">Message</TableHead>
                  <TableHead className="hidden lg:table-cell">Reference</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((err: any) => {
                  const Icon = severityIcons[err.severity] || Info;
                  return (
                    <TableRow key={err.id} className="cursor-pointer" onClick={() => setSelectedError(err)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(err.created_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={severityColors[err.severity] || ""} variant="outline">
                          <Icon className="h-3 w-3 mr-1" />
                          {err.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{err.function_name}</TableCell>
                      <TableCell className="text-xs">{err.error_stage}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs max-w-[200px] truncate">{err.error_message}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-mono max-w-[120px] truncate">{err.reference || "—"}</TableCell>
                      <TableCell>
                        {!err.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); resolveMutation.mutate(err.id); }}
                          >
                            Resolve
                          </Button>
                        )}
                        {err.resolved && <Badge variant="secondary">Resolved</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Time:</span><br />{format(new Date(selectedError.created_at), "PPpp")}</div>
                <div><span className="text-muted-foreground">Severity:</span><br /><Badge className={severityColors[selectedError.severity] || ""} variant="outline">{selectedError.severity}</Badge></div>
                <div><span className="text-muted-foreground">Function:</span><br />{selectedError.function_name}</div>
                <div><span className="text-muted-foreground">Stage:</span><br />{selectedError.error_stage}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Message:</span>
                <p className="mt-1 p-2 bg-muted rounded text-xs">{selectedError.error_message}</p>
              </div>
              {selectedError.reference && (
                <div><span className="text-muted-foreground">Reference:</span> <code className="text-xs">{selectedError.reference}</code></div>
              )}
              {selectedError.escrow_transaction_id && (
                <div><span className="text-muted-foreground">Transaction ID:</span> <code className="text-xs">{selectedError.escrow_transaction_id}</code></div>
              )}
              {selectedError.error_context && Object.keys(selectedError.error_context).length > 0 && (
                <div>
                  <span className="text-muted-foreground">Context:</span>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-48">{JSON.stringify(selectedError.error_context, null, 2)}</pre>
                </div>
              )}
              {!selectedError.resolved && (
                <Button className="w-full" onClick={() => { resolveMutation.mutate(selectedError.id); setSelectedError(null); }}>
                  Mark as Resolved
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentErrors;
