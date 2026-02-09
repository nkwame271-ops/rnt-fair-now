import { useState } from "react";
import { motion } from "framer-motion";
import { FileCheck, Upload, CheckCircle2, Info, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleProperties } from "@/data/dummyData";
import { toast } from "sonner";

const Agreements = () => {
  const [registering, setRegistering] = useState<string | null>(null);

  const unregistered = sampleProperties.flatMap((p) =>
    p.units
      .filter((u) => u.tenant && !u.agreementRegistered)
      .map((u) => ({ ...u, propertyName: p.name, propertyCode: p.code }))
  );

  const handleRegister = (unitId: string) => {
    setRegistering(unitId);
    setTimeout(() => {
      setRegistering(null);
      toast.success("Agreement registered! Certificate and e-stamp sent to email.");
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tenancy Agreements</h1>
        <p className="text-muted-foreground mt-1">Register and manage tenancy agreements (Act 220, Section 4)</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-warning/5 p-3 rounded-lg border border-warning/20">
        <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>By law, every tenancy agreement must be registered within 14 days of signing. Unregistered agreements may result in penalties.</span>
      </div>

      {unregistered.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Pending Registration</h2>
          <div className="space-y-3">
            {unregistered.map((u) => (
              <div key={u.id} className="bg-card rounded-xl p-5 shadow-card border border-destructive/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-card-foreground">{u.propertyName} — {u.name}</h3>
                    <div className="text-sm text-muted-foreground">Tenant: {u.tenant} • {u.type} • GH₵ {u.rent}/mo</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRegister(u.id)}
                    disabled={registering === u.id}
                  >
                    {registering === u.id ? (
                      "Processing..."
                    ) : (
                      <>
                        <FileCheck className="h-4 w-4 mr-1" /> Register
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground space-y-1">
                  <p>Registration will:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Validate rent amount and advance limits</li>
                    <li>Generate unique serial number & e-stamp</li>
                    <li>Issue certificate of registration</li>
                    <li>Charge statutory registration fee (GH₵ 50)</li>
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Registered Agreements</h2>
        <div className="space-y-3">
          {sampleProperties.flatMap((p) =>
            p.units
              .filter((u) => u.agreementRegistered && u.tenant)
              .map((u) => (
                <div key={u.id} className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-card-foreground">{p.name} — {u.name}</div>
                    <div className="text-xs text-muted-foreground">Tenant: {u.tenant} • GH₵ {u.rent}/mo</div>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Registered
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Agreements;
