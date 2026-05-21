import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { renderForm7, Form7Data } from "@/lib/pdf/form7";

/** Live preview — renders Form 7 to a PNG via jsPDF on every change. */
export default function Form7LivePreview({ data }: { data: Form7Data }) {
  const [url, setUrl] = useState<string>("");
  const [previewQr, setPreviewQr] = useState<string | undefined>(undefined);
  const key = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    QRCode.toDataURL("https://www.rentcontrolghana.com/verify/form/PREVIEW", {
      width: 240, margin: 2, errorCorrectionLevel: "M",
    }).then(setPreviewQr).catch((e) => console.warn("Form7 preview QR failed", e));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const merged: Form7Data = {
          ...data,
          qr_data_url: (data as any).qr_data_url || previewQr,
          verification_code: (data as any).verification_code || "PREVIEW",
        };
        const doc = renderForm7(merged);
        setUrl(doc.output("datauristring"));
      } catch (e) {
        console.warn("Form7 preview failed", e);
      }
    }, 250); // debounce
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, previewQr]);

  return (
    <div className="sticky top-4 rounded-lg border bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-background/60">
        Live Form 7 Preview
      </div>
      {url ? (
        <iframe src={url} title="Form 7 preview" className="w-full h-[640px] bg-white" />
      ) : (
        <div className="h-[640px] flex items-center justify-center text-sm text-muted-foreground">
          Building preview…
        </div>
      )}
    </div>
  );
}
