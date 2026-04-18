import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Key, Plus, Copy, Shield, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const ALL_SCOPES = [
  { value: "tax:read", label: "Tax & Revenue", description: "Landlord income, rent tax collected" },
  { value: "tenants:read", label: "Tenants", description: "Registered tenants, delivery lists, non-citizens" },
  { value: "landlords:read", label: "Landlords", description: "Registered landlords, fee status, property counts" },
  { value: "properties:read", label: "Properties", description: "Properties by region, vacant units, conditions" },
  { value: "complaints:read", label: "Complaints", description: "Complaint records and summaries" },
  { value: "stats:read", label: "Statistics", description: "Platform overview, regional breakdown, citizen data" },
  { value: "identity:read", label: "Identity (Restricted)", description: "KYC stats and Ghana Card usage counts" },
];

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "rcd_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

const AgencyApiKeys = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const { error } = await supabase.from("api_keys").insert({
        agency_name: agencyName,
        api_key_hash: keyHash,
        scopes: selectedScopes,
        created_by: user?.id,
      });
      if (error) throw error;
      return rawKey;
    },
    onSuccess: (rawKey) => {
      setGeneratedKey(rawKey);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("api_keys").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key deleted");
    },
  });

  const handleCreate = () => {
    if (!agencyName.trim()) return toast.error("Agency name is required");
    if (selectedScopes.length === 0) return toast.error("Select at least one scope");
    createMutation.mutate();
  };

  const resetForm = () => {
    setAgencyName("");
    setSelectedScopes([]);
    setGeneratedKey(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" /> Agency API Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage API access for external government agencies
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create API Key</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{generatedKey ? "API Key Created" : "Create New API Key"}</DialogTitle>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-destructive mb-2">⚠️ Copy this key now — it won't be shown again!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-2 rounded text-xs break-all font-mono">{generatedKey}</code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success("Copied!"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => { setCreateOpen(false); resetForm(); }}>Done</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Agency Name</Label>
                  <Input placeholder="e.g. Ghana Revenue Authority" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">API Scopes</Label>
                  <div className="space-y-2">
                    {ALL_SCOPES.map((scope) => (
                      <label key={scope.value} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedScopes.includes(scope.value)}
                          onCheckedChange={(checked) =>
                            setSelectedScopes((prev) =>
                              checked ? [...prev, scope.value] : prev.filter((s) => s !== scope.value)
                            )
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">{scope.label}</p>
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Generate API Key"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} API key{apiKeys.length !== 1 ? "s" : ""} issued
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No API keys created yet</p>
            </div>
          ) : (
            <div className="responsive-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key: any) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.agency_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(key.scopes || []).map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? "default" : "destructive"}>
                        {key.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(key.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {key.last_used_at ? format(new Date(key.last_used_at), "dd MMM yyyy HH:mm") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMutation.mutate({ id: key.id, is_active: !key.is_active })}
                        >
                          {key.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Usage</CardTitle>
          <CardDescription>How external agencies call the API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-2">
            <p className="text-muted-foreground"># Example: Get platform stats</p>
            <p>POST {window.location.origin.replace("//id-preview--", "//").replace(".lovable.app", ".supabase.co")}/functions/v1/agency-api</p>
            <p>Header: X-API-Key: rcd_xxxxxxxxxx...</p>
            <p>Body: {"{"}</p>
            <p>&nbsp; "endpoint": "stats/overview",</p>
            <p>&nbsp; "filters": {"{"} "region": "Greater Accra" {"}"}</p>
            <p>{"}"}</p>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {ALL_SCOPES.map((scope) => (
              <div key={scope.value} className="border border-border rounded-lg p-3">
                <p className="text-sm font-semibold">{scope.label}</p>
                <p className="text-xs text-muted-foreground">{scope.description}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">{scope.value}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyApiKeys;
