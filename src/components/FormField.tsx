import { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  valid?: boolean;
  optional?: boolean;
}

const FormField = ({ label, children, hint, error, valid, optional }: FormFieldProps) => (
  <div className="space-y-1.5">
    <Label className="flex items-center gap-1.5 text-sm">
      {label}
      {optional && <span className="text-muted-foreground font-normal text-xs">(optional)</span>}
      {valid && <CheckCircle2 className="h-3.5 w-3.5 text-success ml-auto" />}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export default FormField;
