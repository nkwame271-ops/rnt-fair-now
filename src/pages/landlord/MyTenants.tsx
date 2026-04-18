import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users, Search, MessageCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGHS } from "@/lib/formatters";

interface Row {
  tenancy_id: string;
  tenant_name: string;
  tenant_phone: string | null;
  tenant_user_id: string;
  property_id: string;
  property_name: string;
  property_category: string;
  unit_name: string;
  block_label: string | null;
  room_number: string | null;
  bed_label: string | null;
  status: string;
  rent: number;
  start_date: string | null;
  end_date: string | null;
}

const MyTenants = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, status, agreed_rent, start_date, end_date, unit_id")
        .eq("landlord_user_id", user.id);

      if (!tenancies || tenancies.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const unitIds = tenancies.map((t) => t.unit_id).filter(Boolean) as string[];
      const tenantIds = tenancies.map((t) => t.tenant_user_id);

      const [unitsRes, profilesRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, unit_name, bed_label, hostel_room_id, property_id, properties(property_name, property_category)")
          .in("id", unitIds),
        supabase.from("profiles").select("user_id, full_name, phone").in("user_id", tenantIds),
      ]);

      const roomIds = (unitsRes.data || [])
        .map((u: any) => u.hostel_room_id)
        .filter(Boolean);

      const roomsRes = roomIds.length
        ? await supabase
            .from("hostel_rooms")
            .select("id, block_label, room_number")
            .in("id", roomIds)
        : { data: [] as any[] };

      const unitMap = new Map((unitsRes.data || []).map((u: any) => [u.id, u]));
      const profMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const roomMap = new Map((roomsRes.data || []).map((r: any) => [r.id, r]));

      const out: Row[] = tenancies.map((t: any) => {
        const u: any = unitMap.get(t.unit_id) || {};
        const p: any = profMap.get(t.tenant_user_id) || {};
        const r: any = u.hostel_room_id ? roomMap.get(u.hostel_room_id) : null;
        return {
          tenancy_id: t.id,
          tenant_name: p.full_name || "Unknown",
          tenant_phone: p.phone || null,
          tenant_user_id: t.tenant_user_id,
          property_id: u.property_id || "",
          property_name: u.properties?.property_name || "—",
          property_category: u.properties?.property_category || "residential",
          unit_name: u.unit_name || "—",
          block_label: r?.block_label || null,
          room_number: r?.room_number || null,
          bed_label: u.bed_label || null,
          status: t.status,
          rent: Number(t.agreed_rent || 0),
          start_date: t.start_date,
          end_date: t.end_date,
        };
      });
      setRows(out);
      setLoading(false);
    };
    load();
  }, [user]);

  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => seen.set(r.property_id, r.property_name));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (propertyFilter !== "all" && r.property_id !== propertyFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roomFilter.trim() && (r.room_number || "").toLowerCase() !== roomFilter.trim().toLowerCase()) return false;
      if (s && !`${r.tenant_name} ${r.tenant_phone || ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, search, propertyFilter, statusFilter, roomFilter]);

  const selectedIsHostel = useMemo(() => {
    if (propertyFilter === "all") return rows.some((r) => r.property_category === "hostel");
    return rows.some((r) => r.property_id === propertyFilter && r.property_category === "hostel");
  }, [propertyFilter, rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> My Tenants
        </h1>
        <p className="text-muted-foreground mt-1">
          {rows.length} tenant{rows.length === 1 ? "" : "s"} across your properties
        </p>
      </div>

      <div className="bg-card rounded-xl p-4 shadow-card border border-border space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone"
              className="pl-9"
            />
          </div>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {propertyOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedIsHostel && (
            <Input
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder="Room number (e.g. 001)"
            />
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="responsive-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Room / Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No tenants match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.tenancy_id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{r.tenant_name}</div>
                    {r.tenant_phone && (
                      <div className="text-xs text-muted-foreground">{r.tenant_phone}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.property_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.property_category}</div>
                  </TableCell>
                  <TableCell>
                    {r.room_number ? (
                      <div className="text-sm">
                        <span className="font-medium">{r.block_label} · Room {r.room_number}</span>
                        {r.bed_label && <span className="text-muted-foreground"> · {r.bed_label}</span>}
                      </div>
                    ) : (
                      <div className="text-sm">{r.unit_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatGHS(r.rent)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.start_date || "—"} → {r.end_date || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/landlord/messages" title="Message"><MessageCircle className="h-4 w-4" /></Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/landlord/agreements" title="Agreements"><FileText className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MyTenants;
