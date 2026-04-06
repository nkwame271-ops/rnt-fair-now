import { useState, useEffect } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface Batch {
  id: string;
  batch_label: string;
  prefix: string;
  regions: string[];
  region_details: any[];
  total_unique_serials: number;
  total_physical_cards: number;
  paired_mode: boolean;
  created_at: string;
}

const ProcurementReport = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("generation_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setBatches((data || []) as any[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Procurement Report — Generation Batches", 14, 20);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    let y = 38;
    batches.forEach((b, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.text(`${idx + 1}. ${b.batch_label}`, 14, y);
      doc.setFontSize(8);
      y += 5;
      doc.text(`Prefix: ${b.prefix} | Mode: ${b.paired_mode ? "Paired" : "Single"} | Date: ${new Date(b.created_at).toLocaleDateString()}`, 18, y);
      y += 4;
      doc.text(`Regions: ${b.regions?.join(", ") || "N/A"}`, 18, y);
      y += 4;
      doc.text(`Unique Serials: ${b.total_unique_serials} | Physical Cards: ${b.total_physical_cards}`, 18, y);
      y += 7;
    });

    doc.save(`procurement-report-${Date.now()}.pdf`);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Procurement Report
        </h2>
        {batches.length > 0 && (
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No generation batches yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2">Batch</th>
                <th className="text-left px-3 py-2">Prefix</th>
                <th className="text-left px-3 py-2">Regions</th>
                <th className="text-right px-3 py-2">Unique</th>
                <th className="text-right px-3 py-2">Cards</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map(b => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-medium text-card-foreground">{b.batch_label}</td>
                  <td className="px-3 py-2 font-mono">{b.prefix}</td>
                  <td className="px-3 py-2">
                    {b.regions?.slice(0, 3).map(r => (
                      <Badge key={r} variant="outline" className="text-[10px] mr-1">{r}</Badge>
                    ))}
                    {(b.regions?.length || 0) > 3 && (
                      <Badge variant="secondary" className="text-[10px]">+{b.regions.length - 3}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{b.total_unique_serials.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{b.total_physical_cards.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Badge variant={b.paired_mode ? "default" : "secondary"} className="text-[10px]">
                      {b.paired_mode ? "Paired" : "Single"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProcurementReport;
