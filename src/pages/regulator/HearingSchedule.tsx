import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarClock, Filter } from "lucide-react";

type View = "day" | "week" | "month";

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-300",
  ongoing: "bg-purple-100 text-purple-700 border-purple-300",
  completed: "bg-green-100 text-green-700 border-green-300",
  adjourned: "bg-gray-100 text-gray-700 border-gray-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const HearingSchedule = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [hearings, setHearings] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<Record<string, any>>({});
  const [rooms, setRooms] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [filterOfficer, setFilterOfficer] = useState<string>("all");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const range = useMemo(() => {
    if (view === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (view === "week") {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7) };
    }
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { from, to };
  }, [view, anchor]);

  useEffect(() => {
    (async () => {
      const [hRes, rRes, sRes] = await Promise.all([
        supabase.from("complaint_hearings").select("*")
          .gte("scheduled_at", range.from.toISOString())
          .lt("scheduled_at", range.to.toISOString())
          .order("scheduled_at"),
        supabase.from("hearing_rooms").select("*"),
        supabase.from("admin_staff").select("user_id, full_name, admin_type"),
      ]);
      setHearings(hRes.data || []);
      setRooms(rRes.data || []);
      setOfficers((sRes.data || []).filter((s: any) => ["adjudicating_officer", "case_admin"].includes(s.admin_type)));
      const ids = Array.from(new Set((hRes.data || []).map((h: any) => h.case_id)));
      if (ids.length) {
        const { data: cs } = await supabase
          .from("complaints")
          .select("id, ticket_number, complaint_code, complaint_title, complaint_type, landlord_name, property_address")
          .in("id", ids);
        const map: Record<string, any> = {};
        (cs || []).forEach((c: any) => { map[c.id] = c; });
        setComplaints(map);
      }
    })();
  }, [range.from, range.to]);

  const filtered = useMemo(() => hearings.filter((h) => {
    if (filterOfficer !== "all" && h.officer_user_id !== filterOfficer) return false;
    if (filterRoom !== "all" && h.room_id !== filterRoom) return false;
    if (filterStatus !== "all" && h.status !== filterStatus) return false;
    return true;
  }), [hearings, filterOfficer, filterRoom, filterStatus]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
    const days: Date[] = [];
    let d = new Date(range.from);
    while (d < range.to) { days.push(new Date(d)); d = addDays(d, 1); }
    return days;
  }, [view, anchor, range.from, range.to]);

  const shift = (dir: -1 | 1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };

  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6" /> Hearing Schedule
          </h1>
          <p className="text-sm text-muted-foreground">{range.from.toDateString()} → {addDays(range.to, -1).toDateString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Select value={view} onValueChange={(v) => setView(v as View)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          <Select value={filterOfficer} onValueChange={setFilterOfficer}>
            <SelectTrigger><SelectValue placeholder="Officer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All officers</SelectItem>
              {officers.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRoom} onValueChange={setFilterRoom}>
            <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rooms</SelectItem>
              {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="adjourned">Adjourned</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {view === "month" ? (
        <Card><CardContent className="pt-6">
          <Calendar
            mode="single"
            selected={anchor}
            onSelect={(d) => { if (d) { setAnchor(d); setView("day"); } }}
            modifiers={{
              hasHearing: filtered.map((h) => new Date(h.scheduled_at)),
            }}
            modifiersClassNames={{
              hasHearing: "bg-primary/15 font-semibold text-primary rounded-md",
            }}
            className="rounded-md border w-fit mx-auto"
          />
          <p className="text-xs text-center text-muted-foreground mt-2">
            {filtered.length} hearing(s) in {range.from.toLocaleString("default", { month: "long", year: "numeric" })}. Click a day to drill in.
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(220px, 1fr))` }}>
          {days.map((d) => {
            const dayHearings = filtered.filter((h) => sameDay(new Date(h.scheduled_at), d));
            return (
              <Card key={d.toISOString()} className={sameDay(d, new Date()) ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{dayHearings.length} hearing(s)</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayHearings.length === 0 && <p className="text-xs text-muted-foreground">No hearings.</p>}
                  {dayHearings.map((h) => {
                    const c = complaints[h.case_id];
                    return (
                      <button
                        key={h.id}
                        onClick={() => navigate(`/regulator/complaints/${h.case_id}/hearing/${h.id}`)}
                        className={`w-full text-left rounded border p-2 text-xs hover:shadow transition ${STATUS_COLOR[h.status] || ""}`}
                      >
                        <p className="font-semibold">{new Date(h.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="truncate">{c?.complaint_title || c?.complaint_type || "Case"}</p>
                        <p className="text-[10px] opacity-70 truncate">{c?.ticket_number}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">{h.status}</Badge>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HearingSchedule;
