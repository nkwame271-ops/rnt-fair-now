import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { LucideIcon } from "lucide-react";

export interface SearchableItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  keywords?: string[];
  featureKey?: string;
}

// Keyword registry — enriches nav items with extra search terms
const keywordMap: Record<string, { description: string; keywords: string[] }> = {
  // Regulator
  "/regulator/dashboard": { description: "Overview of platform activity", keywords: ["overview", "summary", "stats", "home"] },
  "/regulator/tenants": { description: "View and manage all tenants", keywords: ["renter", "occupant", "lessee"] },
  "/regulator/landlords": { description: "View and manage all landlords", keywords: ["owner", "property owner", "lessor"] },
  "/regulator/properties": { description: "Browse registered properties", keywords: ["building", "house", "unit", "address"] },
  "/regulator/complaints": { description: "Handle tenant complaints", keywords: ["dispute", "case", "hearing", "schedule", "issue", "grievance"] },
  "/regulator/applications": { description: "Review landlord applications", keywords: ["request", "submission", "ejection"] },
  "/regulator/agreements": { description: "Manage tenancy agreements", keywords: ["contract", "lease", "document", "tenancy"] },
  "/regulator/agreement-templates": { description: "Configure agreement templates", keywords: ["template", "clause", "terms", "boilerplate"] },
  "/regulator/rent-assessments": { description: "Review rent assessment requests", keywords: ["valuation", "price", "increase", "appraisal"] },
  "/regulator/rent-reviews": { description: "Process rent review applications", keywords: ["adjustment", "revision", "review"] },
  "/regulator/terminations": { description: "Handle tenancy terminations", keywords: ["eviction", "ejection", "end", "notice"] },
  "/regulator/rent-cards": { description: "Manage rent card stock and serials", keywords: ["serial", "purchase", "stock", "assign", "batch", "card"] },
  "/regulator/escrow": { description: "View escrow transactions and revenue", keywords: ["payment", "split", "IGF", "revenue", "office", "money", "disbursement"] },
  "/regulator/analytics": { description: "Platform analytics and reports", keywords: ["chart", "report", "data", "graph", "statistics"] },
  "/regulator/kyc": { description: "Verify user identities", keywords: ["identity", "ghana card", "verification", "selfie", "face match"] },
  "/regulator/engine-room": { description: "Feature flags and system config", keywords: ["settings", "config", "toggle", "feature", "flag", "fee"] },
  "/regulator/invite-staff": { description: "Add staff and manage permissions", keywords: ["team", "admin", "sub-admin", "invite", "permission"] },
  "/regulator/feedback": { description: "View beta feedback from users", keywords: ["suggestion", "bug", "report", "beta"] },
  "/regulator/support-chats": { description: "Live support chat sessions", keywords: ["chat", "help", "support", "message"] },
  "/regulator/sms-broadcast": { description: "Send bulk SMS notifications", keywords: ["broadcast", "text", "notification", "bulk"] },
  "/regulator/api-keys": { description: "Manage agency API keys", keywords: ["api", "key", "integration", "external", "agency"] },

  // Landlord
  "/landlord/dashboard": { description: "Landlord overview dashboard", keywords: ["overview", "summary", "home"] },
  "/landlord/my-properties": { description: "View your registered properties", keywords: ["building", "house", "unit", "listing"] },
  "/landlord/register-property": { description: "Register a new property", keywords: ["add", "new", "create", "building"] },
  "/landlord/add-tenant": { description: "Add a tenant to a property", keywords: ["new tenant", "assign", "onboard", "tenancy"] },
  "/landlord/declare-existing-tenancy": { description: "Declare a pre-existing tenancy", keywords: ["existing", "legacy", "current", "migrate"] },
  "/landlord/agreements": { description: "Manage tenancy agreements", keywords: ["contract", "lease", "document"] },
  "/landlord/applications": { description: "View your submitted applications", keywords: ["request", "submission"] },
  "/landlord/complaints": { description: "View complaints against you", keywords: ["dispute", "issue", "grievance", "case"] },
  "/landlord/viewing-requests": { description: "Manage property viewing requests", keywords: ["visit", "tour", "inspection", "showing"] },
  "/landlord/rental-applications": { description: "Review tenant rental applications", keywords: ["applicant", "apply", "prospect"] },
  "/landlord/renewal-requests": { description: "Handle lease renewal requests", keywords: ["extend", "renew", "continuation"] },
  "/landlord/termination": { description: "Submit ejection applications", keywords: ["eviction", "ejection", "end", "notice", "terminate"] },
  "/landlord/messages": { description: "Messages from tenants", keywords: ["chat", "inbox", "communication"] },
  "/landlord/rent-cards": { description: "Manage rent cards for properties", keywords: ["card", "serial", "stock"] },
  "/landlord/payment-settings": { description: "Configure payment methods", keywords: ["bank", "momo", "mobile money", "account"] },
  "/landlord/receipts": { description: "View payment receipts", keywords: ["receipt", "invoice", "proof"] },
  "/landlord/profile": { description: "Edit your profile details", keywords: ["account", "personal", "name", "phone"] },
  "/landlord/rent-increase-request": { description: "Request a rent increase", keywords: ["raise", "higher", "adjustment", "price"] },
  "/landlord/feedback": { description: "Submit beta feedback", keywords: ["suggestion", "bug", "report"] },

  // Tenant
  "/tenant/dashboard": { description: "Tenant overview dashboard", keywords: ["overview", "summary", "home"] },
  "/tenant/marketplace": { description: "Browse available properties", keywords: ["search", "find", "listing", "available", "rent"] },
  "/tenant/rent-checker": { description: "Check fair rent for an area", keywords: ["price", "fair", "benchmark", "calculator", "valuation"] },
  "/tenant/file-complaint": { description: "File a complaint about your landlord", keywords: ["dispute", "issue", "problem", "report", "grievance"] },
  "/tenant/my-cases": { description: "Track your complaint cases", keywords: ["case", "hearing", "status", "track"] },
  "/tenant/payments": { description: "Make and track rent payments", keywords: ["pay", "rent", "money", "due", "balance"] },
  "/tenant/receipts": { description: "View your payment receipts", keywords: ["receipt", "proof", "invoice"] },
  "/tenant/my-agreements": { description: "View your tenancy agreements", keywords: ["contract", "lease", "document"] },
  "/tenant/legal-assistant": { description: "AI-powered legal help", keywords: ["law", "rights", "legal", "advice", "help", "assistant"] },
  "/tenant/renewal": { description: "Request lease renewal", keywords: ["extend", "renew", "continuation"] },
  "/tenant/termination": { description: "Request tenancy termination", keywords: ["end", "leave", "vacate", "notice"] },
  "/tenant/report-side-payment": { description: "Report illegal side payments", keywords: ["bribe", "illegal", "extra", "cash", "side"] },
  "/tenant/preferences": { description: "Manage notification preferences", keywords: ["settings", "notification", "alert", "email"] },
  "/tenant/messages": { description: "Messages from your landlord", keywords: ["chat", "inbox", "communication"] },
  "/tenant/profile": { description: "Edit your profile details", keywords: ["account", "personal", "name", "phone"] },
};

interface CommandSearchProps {
  items: SearchableItem[];
}

const CommandSearch = ({ items }: CommandSearchProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Enrich items with keyword data
  const enrichedItems = useMemo(
    () =>
      items.map((item) => {
        const meta = keywordMap[item.to];
        return {
          ...item,
          description: item.description || meta?.description || "",
          keywords: [...(item.keywords || []), ...(meta?.keywords || [])],
        };
      }),
    [items]
  );

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors max-w-[240px] w-full"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate hidden sm:inline">Search features...</span>
        <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search features, pages, settings..." />
        <CommandList>
          <CommandEmpty>No matching features found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {enrichedItems.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.description} ${item.keywords.join(" ")}`}
                onSelect={() => handleSelect(item.to)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandSearch;
