import { ClipboardCheck } from "lucide-react";
import Seo from "@/components/Seo";
import EmptyState from "@/components/EmptyState";

const AgentPendingTasks = () => {
  return (
    <div className="space-y-6">
      <Seo title="Pending Tasks | Agent" description="Inspections, reminders, and follow-ups assigned to you." />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> Pending Tasks</h1>
        <p className="text-muted-foreground mt-1">Inspections, maintenance follow-ups, rent reminders, tenant visits, and unresolved complaints.</p>
      </div>
      <EmptyState icon={ClipboardCheck} title="No pending tasks" description="Tasks assigned by admins or triggered by landlord requests will appear here." />
    </div>
  );
};

export default AgentPendingTasks;
