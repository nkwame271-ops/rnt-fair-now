import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  propertyId: string;
  enabled: boolean;
  onChange?: (enabled: boolean) => void;
  compact?: boolean;
}

const PropertyManagementToggle = ({ propertyId, enabled, onChange, compact }: Props) => {
  const [value, setValue] = useState(enabled);
  const [busy, setBusy] = useState(false);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_property_management" as any, {
      p_property_id: propertyId,
      p_enabled: next,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Failed to update management support");
      return;
    }
    setValue(next);
    onChange?.(next);
    toast.success(next ? "Management Support enabled — platform will handle tenant interactions" : "Management Support disabled");
  };

  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3 p-3 rounded-lg border border-border bg-muted/30"}`}>
      <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Management Support</span>
          {value && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Managed by Platform</Badge>
          )}
        </div>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform staff handle tenant inquiries, viewings, onboarding and compliance. You still receive rent payments normally.
          </p>
        )}
      </div>
      <Switch checked={value} disabled={busy} onCheckedChange={toggle} />
    </div>
  );
};

export default PropertyManagementToggle;
