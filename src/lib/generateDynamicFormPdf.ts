import jsPDF from "jspdf";

export interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  autofill?: { source: string; path: string };
}
export interface FormSection {
  id: string;
  title: string;
  order: number;
  fields: FormField[];
}
export interface FormSchema { sections: FormSection[]; }
export interface FormLayout {
  page_size?: "A4" | "Letter";
  title_position?: "left" | "center";
  header?: string;
  footer?: string;
  include_qr?: boolean;
  signature_area?: boolean;
  stamp_area?: boolean;
}

export interface DynamicFormPdfInput {
  formName: string;
  formNumber?: string;
  regulationRef?: string;
  schema: FormSchema;
  layout: FormLayout;
  data: Record<string, any>;
}

export const generateDynamicFormPdf = (input: DynamicFormPdfInput): Blob => {
  const doc = new jsPDF({ unit: "mm", format: input.layout.page_size === "Letter" ? "letter" : "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  if (input.layout.header) {
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text(input.layout.header, pageW / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 6;
  }

  // Title
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  const titleAlign = input.layout.title_position === "left" ? "left" : "center";
  const titleX = titleAlign === "center" ? pageW / 2 : margin;
  doc.text(input.formName, titleX, y, { align: titleAlign as any });
  y += 6;
  if (input.formNumber || input.regulationRef) {
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text([input.formNumber, input.regulationRef].filter(Boolean).join(" · "), titleX, y, { align: titleAlign as any });
    doc.setTextColor(0);
    y += 6;
  }
  y += 2;

  const sortedSections = [...input.schema.sections].sort((a, b) => (a.order || 0) - (b.order || 0));

  const ensureSpace = (h: number) => {
    if (y + h > pageH - 20) { doc.addPage(); y = 14; }
  };

  for (const section of sortedSections) {
    ensureSpace(10);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, y);
    doc.setDrawColor(220); doc.line(margin, y + 1, pageW - margin, y + 1);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);

    for (const field of section.fields) {
      const value = input.data[field.id] ?? "";
      if (field.type === "signature" || field.type === "stamp") {
        ensureSpace(20);
        doc.setTextColor(110); doc.text(`${field.label}:`, margin, y);
        doc.setDrawColor(180);
        doc.rect(margin + 50, y - 4, 60, 14);
        if (typeof value === "string" && value.startsWith("data:image")) {
          try { doc.addImage(value, "PNG", margin + 51, y - 3, 58, 12); } catch { /* ignore */ }
        }
        doc.setTextColor(0);
        y += 18;
        continue;
      }
      if (field.type === "long_text") {
        ensureSpace(8);
        doc.setTextColor(110); doc.text(`${field.label}:`, margin, y);
        doc.setTextColor(0);
        y += 5;
        const lines = doc.splitTextToSize(String(value || "—"), pageW - margin * 2);
        ensureSpace(lines.length * 5);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 2;
        continue;
      }
      ensureSpace(6);
      doc.setTextColor(110); doc.text(`${field.label}:`, margin, y);
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(String(value || "—"), pageW - margin * 2 - 50);
      doc.text(lines, margin + 50, y);
      y += 5 * lines.length + 1;
    }
    y += 3;
  }

  if (input.layout.footer) {
    const footerY = pageH - 8;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(input.layout.footer, pageW / 2, footerY, { align: "center" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
};
