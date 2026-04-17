import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: string;
  source_id: string;
  matched_property_id: string;
  score: number;
  similarity_level: "high" | "medium" | "low";
  gps_points: number;
  landlord_name_points: number;
  property_name_points: number;
  property_type_points: number;
  location_points: number;
  tenant_boost_applied: boolean;
  last_calculated_at: string;
  manually_dismissed: boolean;
  _complaint?: { id: string; ticket_number: string; complaint_code: string } | null;
}

const levelStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function PropertySimilarityMatches({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("property_similarity_scores")
      .select("*")
      .eq("matched_property_id", propertyId)
      .order("score", { ascending: false });

    const rows = (data || []) as any as Match[];
    const sourceIds = rows.map(r => r.source_id);
    let cpMap = new Map<string, any>();
    if (sourceIds.length) {
      const { data: cps } = await supabase
        .from("complaint_properties").select("id, complaint_id").in("id", sourceIds);
      const complaintIds = (cps || []).map((c: any) => c.complaint_id).filter(Boolean);
      const { data: comps } = complaintIds.length
        ? await supabase.from("complaints").select("id, ticket_number, complaint_code").in("id", complaintIds)
        : { data: [] as any[] };
      const compMap = new Map((comps || []).map((c: any) => [c.id, c]));
      cpMap = new Map((cps || []).map((cp: any) => [cp.id, compMap.get(cp.complaint_id) || null]));
    }
    setMatches(rows.map(r => ({ ...r, _complaint: cpMap.get(r.source_id) || null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [propertyId]);

  const dismiss = async (m: Match) => {
    setDismissingId(m.id);
    const { error } = await supabase
      .from("property_similarity_scores")
      .update({ manually_dismissed: true, dismissed_by: user?.id, dismissed_at: new Date().toISOString() } as any)
      .eq("id", m.id);
    setDismissingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Match dismissed");
    setMatches(prev => prev.map(x => x.id === m.id ? { ...x, manually_dismissed: true } : x));
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading matches...</div>;
  }

  const visible = matches.filter(m => showDismissed || !m.manually_dismissed);
  const dismissedCount = matches.filter(m => m.manually_dismissed).length;

  if (matches.length === 0) {
    return <div className="text-sm text-muted-foreground italic py-4">No similarity matches found for this property.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{visible.length} match{visible.length === 1 ? "" : "es"} {dismissedCount > 0 && `• ${dismissedCount} dismissed`}</div>
        {dismissedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowDismissed(!showDismissed)} className="gap-1 text-xs">
            {showDismissed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showDismissed ? "Hide" : "Show"} dismissed
          </Button>
        )}
      </div>

      {visible.map(m => (
        <div key={m.id} className={`border rounded-lg p-3 space-y-2 ${m.manually_dismissed ? "opacity-60 bg-muted/30" : "bg-card"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={levelStyles[m.similarity_level]}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {m.similarity_level.toUpperCase()} · {Math.round(m.score)}
              </Badge>
              {m._complaint ? (
                <span className="text-sm font-mono text-foreground">
                  Complaint #{m._complaint.ticket_number || m._complaint.complaint_code}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Source: {m.source_id.slice(0, 8)}</span>
              )}
              {m.tenant_boost_applied && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Tenant boost ×1.15</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!m.manually_dismissed && (
                <Button size="sm" variant="ghost" onClick={() => dismiss(m)} disabled={dismissingId === m.id} className="gap-1 h-7 text-xs">
                  <X className="h-3 w-3" /> Dismiss
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="secondary" className="font-mono">GPS {m.gps_points}/35</Badge>
            <Badge variant="secondary" className="font-mono">Landlord {m.landlord_name_points}/25</Badge>
            <Badge variant="secondary" className="font-mono">Name {m.property_name_points}/15</Badge>
            <Badge variant="secondary" className="font-mono">Type {m.property_type_points}/10</Badge>
            <Badge variant="secondary" className="font-mono">Location {m.location_points}/10</Badge>
          </div>

          <div className="text-xs text-muted-foreground">
            Last calculated: {new Date(m.last_calculated_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyMatchBadge({ propertyId }: { propertyId: string }) {
  const [counts, setCounts] = useState<{ high: number; medium: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("property_similarity_scores")
        .select("similarity_level, manually_dismissed")
        .eq("matched_property_id", propertyId);
      const active = (data || []).filter((r: any) => !r.manually_dismissed);
      setCounts({
        high: active.filter((r: any) => r.similarity_level === "high").length,
        medium: active.filter((r: any) => r.similarity_level === "medium").length,
      });
    })();
  }, [propertyId]);

  if (!counts) return null;
  if (counts.high > 0) {
    return (
      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 gap-0.5">
        <AlertTriangle className="h-2.5 w-2.5" /> High Match · {counts.high}
      </Badge>
    );
  }
  if (counts.medium > 0) {
    return (
      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30 gap-0.5">
        <AlertTriangle className="h-2.5 w-2.5" /> Possible Match · {counts.medium}
      </Badge>
    );
  }
  return null;
}

export function ComplaintSimilarityPanel({ complaintPropertyId }: { complaintPropertyId: string | null | undefined }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!complaintPropertyId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("property_similarity_scores")
        .select("*")
        .eq("source_id", complaintPropertyId)
        .gte("score", 50)
        .eq("manually_dismissed", false)
        .order("score", { ascending: false });

      const rows = (data || []) as any[];
      const propIds = rows.map(r => r.matched_property_id);
      const { data: props } = propIds.length
        ? await supabase.from("properties").select("id, property_name, address, region, property_code").in("id", propIds)
        : { data: [] as any[] };
      const propMap = new Map((props || []).map((p: any) => [p.id, p]));
      setMatches(rows.map(r => ({ ...r, _property: propMap.get(r.matched_property_id) })));
      setLoading(false);
    })();
  }, [complaintPropertyId]);

  if (!complaintPropertyId) return null;
  if (loading) return null;

  if (matches.length === 0) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm text-muted-foreground italic">
        No similar properties found.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Possible property matches found ({matches.length})
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-3 space-y-2">
          {matches.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between gap-2 bg-muted/20 rounded p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {m._property?.property_name || m._property?.property_code || "Unknown property"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {m._property?.address}, {m._property?.region}
                </div>
              </div>
              <Badge variant="outline" className={levelStyles[m.similarity_level]}>
                {m.similarity_level.toUpperCase()} · {Math.round(m.score)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
