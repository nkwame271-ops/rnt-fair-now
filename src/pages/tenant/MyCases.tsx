import { sampleComplaints } from "@/data/dummyData";
import { FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

const statusIcon = {
  Submitted: <Clock className="h-4 w-4 text-info" />,
  "Under Review": <AlertTriangle className="h-4 w-4 text-warning" />,
  "In Progress": <Clock className="h-4 w-4 text-primary" />,
  Resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  Closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const MyCases = () => (
  <div className="max-w-4xl mx-auto space-y-6">
    <div>
      <h1 className="text-3xl font-bold text-foreground">My Cases</h1>
      <p className="text-muted-foreground mt-1">Track the status of your complaints</p>
    </div>

    <div className="space-y-4">
      {sampleComplaints.map((c) => (
        <div key={c.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-bold text-card-foreground">{c.id}</span>
              </div>
              <h3 className="font-semibold text-card-foreground mt-1">{c.type}</h3>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                c.status === "Resolved"
                  ? "bg-success/10 text-success"
                  : c.status === "Under Review"
                  ? "bg-warning/10 text-warning"
                  : c.status === "In Progress"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {statusIcon[c.status]}
              {c.status}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>Landlord: <span className="text-card-foreground font-medium">{c.landlordName}</span></div>
            <div>Property: <span className="text-card-foreground font-medium">{c.propertyAddress}</span></div>
            <div>Filed: <span className="text-card-foreground font-medium">{c.dateSubmitted}</span></div>
            <div>Updated: <span className="text-card-foreground font-medium">{c.lastUpdated}</span></div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{c.description}</p>
        </div>
      ))}
    </div>
  </div>
);

export default MyCases;
