import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, TrendingUp, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const RentIncreaseRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [proposedRent, setProposedRent] = useState("");
  const [reason, setReason] = useState("");
  const [requestType, setRequestType] = useState("new_tenancy");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [currentApprovedRent, setCurrentApprovedRent] = useState<number | null>(null);
  const [existingRequests, setExistingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [{ data: props }, { data: requests }] = await Promise.all([
        supabase.from("properties").select("*, units(id, unit_name, unit_type, monthly_rent)")
          .eq("landlord_user_id", user.id).neq("property_status", "archived"),
        supabase.from("rent_increase_requests").select("*").eq("landlord_user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProperties(props || []);
      setExistingRequests(requests || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  useEffect(() => {
    if (!selectedPropertyId || !selectedUnitId) { setCurrentApprovedRent(null); return; }
    const prop = properties.find(p => p.id === selectedPropertyId);
    const unit = prop?.units?.find((u: any) => u.id === selectedUnitId);
    setCurrentApprovedRent(unit?.monthly_rent || prop?.approved_rent || null);
  }, [selectedPropertyId, selectedUnitId, properties]);

  const selectedUnits = properties.find(p => p.id === selectedPropertyId)?.units || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPropertyId || !proposedRent || !reason) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      let evidenceUrls: string[] = [];
      for (const file of evidenceFiles) {
        const ext = file.name.split(".").pop();
        const path = `rent-increase/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("application-evidence").upload(path, file);
        if (upErr) continue;
        const { data: { publicUrl } } = supabase.storage.from("application-evidence").getPublicUrl(path);
        evidenceUrls.push(publicUrl);
      }

      const { error } = await supabase.from("rent_increase_requests").insert({
        property_id: selectedPropertyId,
        unit_id: selectedUnitId || null,
        landlord_user_id: user.id,
        current_approved_rent: currentApprovedRent || 0,
        proposed_rent: parseFloat(proposedRent),
        reason,
        request_type: requestType,
        evidence_urls: evidenceUrls,
      } as any);

      if (error) throw error;
      toast.success("Rent increase request submitted for review");
      navigate("/landlord/my-properties");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/landlord/my-properties")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to My Properties
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Request Rent Increase
        </h1>
        <p className="text-muted-foreground mt-1">Submit a request to increase rent for one of your properties. All increases require administrator review.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <div className="space-y-2">
            <Label>Property *</Label>
            <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setSelectedUnitId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.property_name || p.property_code} — {p.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPropertyId && selectedUnits.length > 0 && (
            <div className="space-y-2">
              <Label>Unit (optional)</Label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {selectedUnits.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.unit_name} ({u.unit_type}) — GH₵ {u.monthly_rent?.toLocaleString()}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentApprovedRent !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current rent:</span>
              <span className="font-semibold">GH₵ {currentApprovedRent.toLocaleString()}/mo</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Proposed New Rent (GH₵) *</Label>
            <Input type="number" value={proposedRent} onChange={(e) => setProposedRent(e.target.value)} placeholder="e.g. 1500" required />
          </div>

          <div className="space-y-2">
            <Label>Request Type *</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new_tenancy">New Tenancy (after previous tenant left)</SelectItem>
                <SelectItem value="active_tenancy">Active Tenancy Increase</SelectItem>
                <SelectItem value="material_upgrade">Material Upgrade / Renovation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason for Increase *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why you are requesting a rent increase..." rows={4} required />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Supporting Evidence</Label>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(e) => {
                if (e.target.files) setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 5));
              }}
              className="text-sm"
            />
            {evidenceFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {evidenceFiles.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {f.name}
                    <button type="button" onClick={() => setEvidenceFiles(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Upload renovation receipts, utility bills, or other supporting documents (up to 5 files)</p>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Rent Increase Request"}
        </Button>
      </form>

      {/* Existing requests */}
      {existingRequests.length > 0 && (
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <h3 className="font-semibold text-card-foreground">Previous Requests</h3>
          <div className="space-y-2">
            {existingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                <div className="text-sm">
                  <span className="font-medium">GH₵ {Number(req.current_approved_rent).toLocaleString()} → GH₵ {Number(req.proposed_rent).toLocaleString()}</span>
                  <span className="text-muted-foreground ml-2">({req.request_type?.replace(/_/g, " ")})</span>
                </div>
                <Badge variant="outline" className={`text-xs ${
                  req.status === "approved" ? "bg-success/10 text-success" :
                  req.status === "rejected" ? "bg-destructive/10 text-destructive" :
                  "bg-warning/10 text-warning"
                }`}>
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RentIncreaseRequest;
