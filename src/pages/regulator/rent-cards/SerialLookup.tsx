import { useState } from "react";
import { Search, Loader2, MapPin, ScrollText, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface CardLink {
  card_id: string;
  card_status: string;
  landlord_user_id: string | null;
  landlord_name: string | null;
  tenant_user_id: string | null;
  tenant_name: string | null;
  tenancy_id: string | null;
  tenancy_code: string | null;
  tenancy_status: string | null;
}

interface StockRow {
  pair_index: number;
  status: string;
  stock_type: string;
  office_name: string | null;
  region: string | null;
  batch_label: string | null;
  assigned_at: string | null;
  unassigned_at: string | null;
  revoked_at: string | null;
}

interface LookupResult {
  serial_number: string;
  found: boolean;
  location_kind?: string;
  location_label?: string;
  stock_rows?: StockRow[];
  assignment?: { cards: CardLink[] };
  last_action?: { action: string; reason: string; created_at: string } | null;
}

const expandRange = (input: string): string[] => {
  // Parse serials from textarea: split by newlines or commas, expand "A → B" or "A-B" if same prefix+numeric tail
  const tokens = input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const rangeMatch = tok.match(/^(\S+?)\s*(?:→|->|-|to)\s*(\S+)$/i);
    if (rangeMatch) {
      const [, a, b] = rangeMatch;
      // Try to expand if prefix matches and tail is numeric
      const pm = a.match(/^(.*?)(\d+)$/);
      const qm = b.match(/^(.*?)(\d+)$/);
      if (pm && qm && pm[1] === qm[1]) {
        const start = parseInt(pm[2], 10);
        const end = parseInt(qm[2], 10);
        const pad = pm[2].length;
        const [lo, hi] = start <= end ? [start, end] : [end, start];
        if (hi - lo > 2000) {
          out.push(a, b); // refuse huge ranges, treat as two serials
        } else {
          for (let i = lo; i <= hi; i++) {
            out.push(pm[1] + String(i).padStart(pad, "0"));
          }
        }
        continue;
      }
    }
    out.push(tok);
  }
  return Array.from(new Set(out.map((s) => s.toUpperCase())));
};

const SerialLookup = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LookupResult[]>([]);

  const handleLookup = async () => {
    const serials = expandRange(input);
    if (!serials.length) {
      toast.error("Enter at least one serial");
      return;
    }
    if (serials.length > 500) {
      toast.error("Limit lookups to 500 serials at a time");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("lookup_serial_details" as any, {
        p_serials: serials,
      });
      if (error) throw error;
      setResults(((data as any)?.results || []) as LookupResult[]);
    } catch (err: any) {
      toast.error(err.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const toneFor = (kind?: string) => {
    if (kind === "central") return "bg-muted text-muted-foreground";
    if (kind === "regional") return "bg-indigo-500/10 text-indigo-700";
    if (kind === "office") return "bg-success/10 text-success";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Serial Lookup
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Look up the current location, status, batch, last admin action, and any linked landlord/tenancy
            for one or many serials. Supports single serials, comma/newline lists, and ranges like{" "}
            <span className="font-mono">RC-0001 → RC-0050</span>.
          </p>
        </div>

        <Textarea
          rows={4}
          placeholder={"e.g. RC-0001\nRC-0042, RC-0100\nRC-0200 → RC-0250"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono text-sm"
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {input.trim() ? `${expandRange(input).length} serial(s) parsed` : "No serials parsed yet"}
          </p>
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Lookup
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.serial_number} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-sm text-card-foreground">{r.serial_number}</p>
                  {!r.found ? (
                    <Badge className="bg-destructive/10 text-destructive">Not in stock</Badge>
                  ) : (
                    <Badge className={toneFor(r.location_kind)}>
                      <MapPin className="h-3 w-3 mr-1" />
                      {r.location_label}
                    </Badge>
                  )}
                </div>
                {r.found && (
                  <a
                    href={`/regulator/rent-cards?tab=admin_actions&serial=${encodeURIComponent(r.serial_number)}`}
                    className="text-xs text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    Open in Admin Actions <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {r.found && r.stock_rows && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {r.stock_rows.map((s) => (
                    <div key={s.pair_index} className="border border-border/60 rounded-md p-2">
                      <p className="font-medium text-card-foreground">Pair #{s.pair_index}</p>
                      <p className="text-muted-foreground">Status: {s.status}</p>
                      <p className="text-muted-foreground">Batch: {s.batch_label || "—"}</p>
                      {s.assigned_at && (
                        <p className="text-muted-foreground">Assigned: {format(new Date(s.assigned_at), "dd/MM/yy HH:mm")}</p>
                      )}
                      {s.revoked_at && (
                        <p className="text-muted-foreground">Revoked: {format(new Date(s.revoked_at), "dd/MM/yy HH:mm")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {r.found && r.assignment?.cards && r.assignment.cards.length > 0 && (
                <div className="border-t border-border/60 pt-3 space-y-1.5">
                  <p className="text-xs font-medium text-card-foreground flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" /> Linked rent cards
                  </p>
                  {r.assignment.cards.map((c) => (
                    <div key={c.card_id} className="text-xs text-muted-foreground">
                      <span className="font-mono">{c.card_status}</span>
                      {c.tenancy_code && (
                        <>
                          {" · Tenancy "}
                          <span className="font-mono">{c.tenancy_code}</span>
                          {c.tenancy_status ? ` (${c.tenancy_status})` : ""}
                        </>
                      )}
                      {c.landlord_name && <> · Landlord: {c.landlord_name}</>}
                      {c.tenant_name && <> · Tenant: {c.tenant_name}</>}
                    </div>
                  ))}
                </div>
              )}

              {r.found && r.last_action && (
                <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground flex items-start gap-2">
                  <ScrollText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-card-foreground">{r.last_action.action}</span>
                    {" · "}
                    {format(new Date(r.last_action.created_at), "dd/MM/yyyy HH:mm")}
                    {r.last_action.reason && <> · {r.last_action.reason}</>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SerialLookup;
