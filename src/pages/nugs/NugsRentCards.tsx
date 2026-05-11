import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LogoLoader from "@/components/LogoLoader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const NugsRentCards = () => {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rent_cards")
        .select("id, serial_number, status, current_rent, assigned_office_name, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setCards(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LogoLoader message="Loading rent cards..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" /> Rent Cards
        </h1>
        <p className="text-muted-foreground mt-1">{cards.length} card(s) visible to your office</p>
      </div>
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="responsive-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Current Rent</TableHead>
                <TableHead>Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No rent cards available.</TableCell></TableRow>
              ) : cards.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.serial_number || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{c.status}</Badge></TableCell>
                  <TableCell className="text-sm">{c.assigned_office_name || "—"}</TableCell>
                  <TableCell className="text-sm">{c.current_rent ? `GHS ${Number(c.current_rent).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default NugsRentCards;
