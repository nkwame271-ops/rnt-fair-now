import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, UserCheck } from "lucide-react";

export interface PartyMatch {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role?: string | null;
}

interface Props {
  label: string;
  value: PartyMatch | null;
  onChange: (party: PartyMatch | null) => void;
  roleFilter?: "tenant" | "landlord" | null;
}

const PartySearchCombobox = ({ label, value, onChange, roleFilter }: Props) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PartyMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2 || value) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const cleaned = q.replace(/\D/g, "");
      const phoneNorm = cleaned.length === 10 && cleaned.startsWith("0")
        ? "233" + cleaned.slice(1)
        : cleaned.length === 9 ? "233" + cleaned : cleaned;

      let query = supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .limit(8);

      if (cleaned.length >= 4) {
        query = query.or(`phone.ilike.%${cleaned}%,phone.ilike.%${phoneNorm}%`);
      } else {
        query = query.ilike("full_name", `%${q}%`);
      }
      const { data } = await query;
      let rows = (data || []) as PartyMatch[];
      if (roleFilter && rows.length > 0) {
        const ids = rows.map((r) => r.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
        rows = rows
          .map((r) => ({ ...r, role: roleMap.get(r.user_id) }))
          .filter((r) => r.role === roleFilter);
      }
      setResults(rows);
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [q, roleFilter, value]);

  if (value) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2 p-2 rounded-lg border bg-success/5">
          <UserCheck className="h-4 w-4 text-success" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.full_name || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {value.phone} {value.role && <Badge variant="outline" className="ml-1 text-[10px]">{value.role}</Badge>}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(null); setQ(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 relative">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading && <p className="p-2 text-xs text-muted-foreground">Searching…</p>}
          {results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              onMouseDown={() => { onChange(r); setQ(""); setOpen(false); }}
              className="w-full text-left p-2 hover:bg-accent text-sm"
            >
              <p className="font-medium">{r.full_name || "Unnamed"}</p>
              <p className="text-xs text-muted-foreground">{r.phone} {r.role && `· ${r.role}`}</p>
            </button>
          ))}
          {!loading && results.length === 0 && q.length >= 2 && (
            <p className="p-2 text-xs text-muted-foreground">No matches — fill placeholder fields below.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PartySearchCombobox;
