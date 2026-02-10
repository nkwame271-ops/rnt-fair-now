import { sampleProperties } from "@/data/dummyData";
import { Building2, Users, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const MyProperties = () => (
  <div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Properties</h1>
        <p className="text-muted-foreground mt-1">Overview of all registered properties</p>
      </div>
      <Link to="/landlord/add-tenant">
        <Button><UserPlus className="h-4 w-4 mr-1" /> Add Tenant</Button>
      </Link>
    </div>

    <div className="space-y-5">
      {sampleProperties.map((p) => (
        <div key={p.id} className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="gradient-hero p-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{p.name}</h2>
                <div className="flex items-center gap-1 text-sm text-primary-foreground/80 mt-1">
                  <MapPin className="h-3.5 w-3.5" /> {p.address}
                </div>
              </div>
              <span className="text-xs bg-primary-foreground/20 px-2.5 py-1 rounded-full font-semibold">
                {p.code}
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {p.units.length} units</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.units.filter((u) => u.tenant).length} tenants</span>
            </div>
          </div>
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left pb-2 font-medium">Unit</th>
                  <th className="text-left pb-2 font-medium">Type</th>
                  <th className="text-left pb-2 font-medium">Rent</th>
                  <th className="text-left pb-2 font-medium">Tenant</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {p.units.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-card-foreground">{u.name}</td>
                    <td className="py-3 text-muted-foreground">{u.type}</td>
                    <td className="py-3 font-semibold text-card-foreground">GH₵ {u.rent}</td>
                    <td className="py-3 text-card-foreground">{u.tenant || "—"}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.status === "Occupied" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.agreementRegistered ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}>
                        {u.agreementRegistered ? "Registered" : "Unregistered"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default MyProperties;
