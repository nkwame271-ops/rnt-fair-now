import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { ClipboardCheck, ShieldCheck, Loader2 } from "lucide-react";
import Seo from "@/components/Seo";
import { QRCodeSVG } from "qrcode.react";
import { useFeeConfig } from "@/hooks/useFeatureFlag";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";
import PropertyLocationPicker from "@/components/PropertyLocationPicker";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    inspected: "bg-indigo-100 text-indigo-800",
    certified: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

interface Props {
  variant: "landlord" | "tenant";
}

const PropertyAssessmentsPage = ({ variant }: Props) => {
  const { user } = useAuth();
  const { amount: feeAmount, enabled: feeEnabled } = useFeeConfig("property_assessment");
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [mode, setMode] = useState<"registered" | "intent">("registered");
  const [propertyId, setPropertyId] = useState("");
  const [reason, setReason] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [ghanaPostGps, setGhanaPostGps] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let propQuery;
    if (variant === "landlord") {
      propQuery = supabase.from("properties").select("id, address").eq("landlord_user_id", user.id);
    } else {
      const { data: ts } = await supabase.from("tenancies").select("property_id").eq("tenant_user_id", user.id);
      const ids = [...new Set((ts || []).map((t: any) => t.property_id).filter(Boolean))];
      propQuery = ids.length
        ? supabase.from("properties").select("id, address").in("id", ids)
        : Promise.resolve({ data: [] as any[] });
    }
    const [{ data: props }, { data: appRows }, { data: certRows }] = await Promise.all([
      propQuery as any,
      supabase.from("property_assessment_applications").select("*").eq("requested_by", user.id).order("created_at", { ascending: false }),
      supabase.from("property_assessment_certificates").select("*").order("issued_at", { ascending: false }).limit(100),
    ]);
    setProperties(props || []);
    setApps(appRows || []);
    setCerts(certRows || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, variant]);

  // Tenants with no linked property default to intent-to-rent mode.
  useEffect(() => {
    if (variant === "tenant" && !loading && properties.length === 0) {
      setMode("intent");
    }
  }, [variant, loading, properties.length]);

  const submit = async () => {
    if (mode === "registered" && !propertyId) { toast.error("Select a property"); return; }
    if (mode === "intent" && !addressLine.trim()) { toast.error("Enter the property address"); return; }
    if (mode === "intent" && !coords) { toast.error("Pin the property location on the map"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("assessment-checkout", {
        body: {
          property_id: mode === "registered" ? propertyId : null,
          requester_role: variant,
          reason,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          ghana_post_gps: ghanaPostGps || null,
          address_line: mode === "intent" ? addressLine : null,
          landmark: landmark || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const payload = data as any;
      if (payload?.no_payment) {
        toast.success("Assessment request submitted.");
        setReason(""); setPropertyId(""); setAddressLine(""); setLandmark(""); setGhanaPostGps(""); setCoords(null);
        load();
        return;
      }
      startBrandedCheckout({
        ...payload,
        confirmationPath: "/assessments/confirm",
        callbackPath: window.location.pathname,
      });
      setReason(""); setPropertyId(""); setAddressLine(""); setLandmark(""); setGhanaPostGps(""); setCoords(null);
    } catch (e: any) {
      toast.error(e.message || "Could not start assessment checkout");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const propAddr = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.address || id.slice(0, 8)) : "";
  const relatedCerts = certs.filter((c) => properties.some((p) => p.id === c.property_id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Seo title="Property Assessments | Rent Control" description="Apply for habitability inspection and view certificates." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" /> Property Assessments
        </h1>
        <p className="text-muted-foreground mt-1">
          Request an official habitability inspection and view issued certificates.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-bold">Request an inspection</h2>

        {variant === "tenant" && (
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "registered" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="registered" disabled={properties.length === 0} />
              <div className="text-sm">
                <div className="font-medium">A property I currently rent</div>
                <div className="text-xs text-muted-foreground">Choose from your active tenancies</div>
              </div>
            </label>
            <label className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "intent" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="intent" />
              <div className="text-sm">
                <div className="font-medium">A property I intend to rent</div>
                <div className="text-xs text-muted-foreground">Enter the address and pin the location</div>
              </div>
            </label>
          </RadioGroup>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mode === "registered" ? (
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>Property address</Label>
              <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="House / street / area" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Assessment fee</Label>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm">{feeEnabled && feeAmount > 0 ? `GHS ${feeAmount.toLocaleString()}` : "Free"}</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nearest landmark (optional)</Label>
          <Input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. behind Melcom, near Total filling station" />
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          <PropertyLocationPicker
            onLocationChange={(loc) => setCoords(loc ? { lat: loc.lat, lng: loc.lng } : null)}
            onGhanaPostGpsChange={setGhanaPostGps}
            ghanaPostGps={ghanaPostGps}
            required={mode === "intent"}
          />
        </div>

        <div className="space-y-2">
          <Label>Reason / notes (optional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need this inspection?" rows={3} />
        </div>
        <Button onClick={submit} disabled={submitting || (mode === "registered" && properties.length === 0)}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit &amp; pay
        </Button>
        {mode === "registered" && properties.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {variant === "landlord" ? "Register a property first." : "Switch to \"A property I intend to rent\" to continue."}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-bold">My requests</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {apps.map((a) => (
              <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{a.property_id ? propAddr(a.property_id) : (a.address_line || "Intended rental")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "dd MMM yyyy")} • Fee GHS {Number(a.fee_amount).toLocaleString()}
                    {a.scheduled_at ? ` • Scheduled ${format(new Date(a.scheduled_at), "dd MMM")}` : ""}
                  </p>
                </div>
                <Badge className={statusBadge(a.status)}>{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Certificates</h2>
        {relatedCerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificates issued yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedCerts.map((c) => {
              const isValid = c.status === "valid" && (!c.expires_at || new Date(c.expires_at) > new Date());
              const url = typeof window !== "undefined" ? `${window.location.origin}/verify/assessment/${c.qr_token}` : c.qr_token;
              return (
                <div key={c.id} className="rounded-xl border border-border p-4 flex gap-3 items-center">
                  <div className="p-1 bg-white rounded border border-border shrink-0"><QRCodeSVG value={url} size={72} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-primary">{c.certificate_number}</p>
                    <p className="text-sm font-medium truncate">{propAddr(c.property_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Issued {format(new Date(c.issued_at), "dd MMM yyyy")}
                      {c.expires_at ? ` • Expires ${format(new Date(c.expires_at), "dd MMM yyyy")}` : ""}
                    </p>
                    <Badge className={isValid ? "bg-success/10 text-success mt-1" : "bg-destructive/10 text-destructive mt-1"}>
                      {isValid ? "Valid" : c.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyAssessmentsPage;
