import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

export default function PdfLivePreview({
  data,
  render,
  label,
}: {
  data: any;
  render: (d: any) => jsPDF;
  label: string;
}) {
  const [url, setUrl] = useState<string>("");
  const key = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const doc = render(data);
        setUrl(doc.output("datauristring"));
      } catch (e) {
        console.warn(label + " preview failed", e);
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-background/60 flex-shrink-0">
        {label}
      </div>
      {url ? (
        <iframe src={url} title={label} className="w-full flex-1 bg-white min-h-[640px]" />
      ) : (
        <div className="flex-1 min-h-[640px] flex items-center justify-center text-sm text-muted-foreground">
          Building preview…
        </div>
      )}
    </div>
  );
}
