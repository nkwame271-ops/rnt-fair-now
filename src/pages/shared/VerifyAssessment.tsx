import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

const VerifyAssessment = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from("property_assessment_certificates")
        .select("*")
        .eq("qr_token", token)
        .maybeSingle();
      setCert(data);
      if (data?.property_id) {
        const { data: p } = await supabase.from("properties").select("address").eq("id", data.property_id).maybeSingle();
        setProperty(p);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!cert) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md w-full space-y-3">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">Certificate Not Found</h1>
        <p className="text-muted-foreground text-sm">This verification link is invalid.</p>
      </div>
    </div>
  );

  const isValid = cert.status === "valid" && (!cert.expires_at || new Date(cert.expires_at) > new Date());

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl border border-border shadow-card max-w-md w-full overflow-hidden">
        <div className="bg-primary p-5 text-center space-y-2">
          <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 mx-auto opacity-95" />
          <h1 className="text-lg font-bold text-primary-foreground flex items-center justify-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Habitability Certificate
          </h1>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Certificate No.</p>
              <p className="font-mono font-bold text-primary">{cert.certificate_number}</p>
            </div>
            <Badge className={isValid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
              {isValid ? <><Shield className="h-3 w-3 mr-1" /> Valid</> : <><AlertTriangle className="h-3 w-3 mr-1" /> {cert.status}</>}
            </Badge>
          </div>
          {property?.address && (
            <div><p className="text-muted-foreground text-xs">Property</p><p className="font-semibold">{property.address}</p></div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Issued</p><p className="font-semibold">{format(new Date(cert.issued_at), "dd/MM/yyyy")}</p></div>
            {cert.expires_at && (
              <div><p className="text-muted-foreground text-xs">Expires</p><p className="font-semibold">{format(new Date(cert.expires_at), "dd/MM/yyyy")}</p></div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
            Verified by RentControlGhana • {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyAssessment;
