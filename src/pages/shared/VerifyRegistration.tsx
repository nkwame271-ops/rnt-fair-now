import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const VerifyRegistration = () => {
  const { role, id } = useParams<{ role: string; id: string }>();
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [feePaid, setFeePaid] = useState(false);
  const [regDate, setRegDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!role || !id) { setLoading(false); return; }

      try {
        const { data, error } = await supabase.functions.invoke("verify-registration", {
          body: { role, id },
        });

        if (error) {
          console.error("Verification error:", error);
          setLoading(false);
          return;
        }

        if (data?.found) {
          setFound(true);
          setName(data.name);
          setStatus(data.status);
          setFeePaid(data.feePaid);
          setRegDate(data.registrationDate);
          setExpiryDate(data.expiryDate);
        }
      } catch (err) {
        console.error("Verification error:", err);
      }
      setLoading(false);
    };
    verify();
  }, [role, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <Shield className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Registration Verification</h1>

          {!found ? (
            <div className="space-y-2">
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
              <p className="text-destructive font-semibold">Not Found</p>
              <p className="text-sm text-muted-foreground">No {role} with ID <code className="font-mono">{id}</code> was found in the system.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feePaid ? (
                <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
              ) : (
                <XCircle className="h-16 w-16 text-warning mx-auto" />
              )}
              <h2 className="text-lg font-semibold text-foreground">{name}</h2>
              <code className="text-primary font-mono font-bold text-lg">{id}</code>
              <div className="flex items-center justify-center gap-2">
                <Badge variant={feePaid ? "default" : "destructive"}>
                  {feePaid ? "Registered & Active" : "Fee Unpaid"}
                </Badge>
                <Badge variant="outline" className="capitalize">{status}</Badge>
              </div>
              {regDate && (
                <p className="text-xs text-muted-foreground">
                  Registered: {new Date(regDate).toLocaleDateString()}
                  {expiryDate && ` • Expires: ${new Date(expiryDate).toLocaleDateString()}`}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Ghana Rent Control • Verification Portal
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyRegistration;
