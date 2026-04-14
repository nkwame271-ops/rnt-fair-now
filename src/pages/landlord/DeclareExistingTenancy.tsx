import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, CheckCircle2, Upload, Loader2, FileText, AlertCircle, Phone, UserPlus, Mic, Square, Trash2 } from "lucide-react";
import { generateAgreementPdf } from "@/lib/generateAgreementPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Step = "select-unit" | "find-tenant" | "details" | "agreement-choice" | "review" | "done";

interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  region: string;
  area: string;
  ghana_post_gps: string | null;
  units: { id: string; unit_name: string; unit_type: string; monthly_rent: number; status: string }[];
}

const SESSION_KEY = "declare_existing_tenancy_form";

const DeclareExistingTenancy = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("select-unit");
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  // Tenant input
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [matchedTenant, setMatchedTenant] = useState<{ userId: string; fullName: string; tenantIdCode: string } | null>(null);
  const [phoneSearchDone, setPhoneSearchDone] = useState(false);

  const [rent, setRent] = useState("");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [existingStartDate, setExistingStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  // Inline audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [availableRentCards, setAvailableRentCards] = useState<{ id: string; serial_number: string }[]>([]);
  const [selectedRentCardId, setSelectedRentCardId] = useState("");
  const [selectedRentCardId2, setSelectedRentCardId2] = useState("");

  // Rent band fees for existing tenancy
  const [existingBand, setExistingBand] = useState<{ register_fee: number; filing_fee: number; agreement_fee: number; fee_amount: number; id: string } | null>(null);
  const [feeEnabled, setFeeEnabled] = useState(true);
  // Agreement choice: "upload" or "buy"
  const [agreementChoice, setAgreementChoice] = useState<"upload" | "buy">("upload");

  // Audio recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.onerror = () => {
        toast.error("Audio recording failed.");
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Could not access microphone. Please allow microphone access.");
    }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const property = properties.find(p => p.id === selectedPropertyId);
  const unit = property?.units.find(u => u.id === selectedUnitId);

  // Restore form from sessionStorage after payment redirect
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success" || status === "fee_paid") {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Re-populate and auto-submit
          setSelectedPropertyId(data.selectedPropertyId || "");
          setSelectedUnitId(data.selectedUnitId || "");
          setTenantName(data.tenantName || "");
          setTenantPhone(data.tenantPhone || "");
          setMatchedTenant(data.matchedTenant || null);
          setPhoneSearchDone(true);
          setRent(data.rent || "");
          setAdvancePaid(data.advancePaid || "0");
          setExistingStartDate(data.existingStartDate || "");
          setExpiryDate(data.expiryDate || "");
          setSelectedRentCardId(data.selectedRentCardId || "");
          setSelectedRentCardId2(data.selectedRentCardId2 || "");
          // Mark that we should auto-submit after data loads
          sessionStorage.setItem("declare_auto_submit", "true");
        } catch {
          // ignore
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: propData }, { data: cardData }] = await Promise.all([
        supabase
          .from("properties")
          .select("id, property_name, address, region, area, ghana_post_gps, units(id, unit_name, unit_type, monthly_rent, status)")
          .eq("landlord_user_id", user.id),
        supabase
          .from("rent_cards")
          .select("id, serial_number")
          .eq("landlord_user_id", user.id)
          .in("status", ["valid", "awaiting_serial"])
          .is("tenancy_id", null),
      ]);
      setProperties((propData || []) as PropertyWithUnits[]);
      setAvailableRentCards((cardData || []).filter((c: any) => c.serial_number) as { id: string; serial_number: string }[]);
      setLoading(false);

      // Check for auto-submit after payment redirect
      if (sessionStorage.getItem("declare_auto_submit") === "true") {
        sessionStorage.removeItem("declare_auto_submit");
        // Small delay to allow state to settle
        setTimeout(() => {
          const saved = sessionStorage.getItem(SESSION_KEY);
          if (saved) {
            sessionStorage.removeItem(SESSION_KEY);
            autoSubmitAfterPayment(JSON.parse(saved), propData || []);
          }
        }, 500);
      }
    };
    fetchData();
  }, [user]);

  // Fetch fee flag
  useEffect(() => {
    const fetchFee = async () => {
      const { data } = await supabase
        .from("feature_flags")
        .select("fee_enabled, fee_amount")
        .eq("feature_key", "agreement_sale_fee")
        .single();
      if (data) {
        setFeeEnabled(data.fee_enabled);
      }
    };
    fetchFee();
  }, []);

  // Lookup existing tenancy rent band when rent changes
  useEffect(() => {
    const monthlyRent = parseFloat(rent) || 0;
    if (monthlyRent <= 0) { setExistingBand(null); return; }
    const lookupBand = async () => {
      const { data: bands } = await supabase
        .from("rent_bands")
        .select("id, min_rent, max_rent, fee_amount, register_fee, filing_fee, agreement_fee")
        .eq("band_type", "existing_tenancy")
        .order("min_rent");
      if (bands) {
        for (const band of bands as any[]) {
          const min = Number(band.min_rent);
          const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
          if (monthlyRent >= min && monthlyRent <= max) {
            setExistingBand({
              id: band.id,
              fee_amount: Number(band.fee_amount),
              register_fee: Number(band.register_fee ?? 0),
              filing_fee: Number(band.filing_fee ?? 0),
              agreement_fee: Number(band.agreement_fee ?? 0),
            });
            return;
          }
        }
      }
      setExistingBand(null);
    };
    lookupBand();
  }, [rent]);

  // Phone search for existing tenant
  const handlePhoneSearch = async () => {
    if (!tenantPhone.trim()) return;
    setPhoneSearching(true);
    setMatchedTenant(null);
    setPhoneSearchDone(false);
    try {
      // Normalize phone for search
      let normalizedPhone = tenantPhone.trim().replace(/\s/g, "");
      // Search profiles by phone
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .or(`phone.eq.${normalizedPhone},phone.eq.0${normalizedPhone.replace(/^233/, "")},phone.eq.233${normalizedPhone.replace(/^0/, "")}`);

      if (profiles && profiles.length > 0) {
        const p = profiles[0];
        // Check if they have a tenant record
        const { data: tenant } = await supabase.from("tenants").select("tenant_id").eq("user_id", p.user_id).single();
        if (tenant) {
          setMatchedTenant({ userId: p.user_id, fullName: p.full_name, tenantIdCode: tenant.tenant_id });
          toast.success(`Tenant found: ${p.full_name}`);
        } else {
          // User exists but not a tenant
          setMatchedTenant({ userId: p.user_id, fullName: p.full_name, tenantIdCode: "" });
          toast.info(`User found (${p.full_name}) but not registered as tenant — tenancy will be linked to their account.`);
        }
      } else {
        toast.info("No account found — an SMS invitation will be sent to this number.");
      }
    } catch {
      toast.error("Search failed.");
    } finally {
      setPhoneSearching(false);
      setPhoneSearchDone(true);
    }
  };

  const autoSubmitAfterPayment = async (savedData: any, propsData: any[]) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Verify payment with backend to ensure receipt, splits, and ledger entries are created
      const ref = new URLSearchParams(window.location.search).get("reference")
        || new URLSearchParams(window.location.search).get("trxref")
        || sessionStorage.getItem("pendingPaymentReference");
      if (ref) {
        try {
          const { data: vData } = await supabase.functions.invoke("verify-payment", {
            body: { reference: ref },
          });
          if (vData?.verified) {
            toast.success("Payment confirmed!");
          } else {
            toast.warning("Payment verification pending — tenancy will still be created.");
          }
        } catch (verifyErr) {
          console.error("Payment verification error:", verifyErr);
        }
        sessionStorage.removeItem("pendingPaymentReference");
      }

      const prop = propsData.find((p: any) => p.id === savedData.selectedPropertyId);
      const unitData = prop?.units?.find((u: any) => u.id === savedData.selectedUnitId);
      if (!prop || !unitData) throw new Error("Property or unit not found");

      await createTenancyRecord(savedData, prop, unitData);
    } catch (err: any) {
      toast.error(err.message || "Failed to declare tenancy after payment");
    } finally {
      setSubmitting(false);
    }
  };

  const createTenancyRecord = async (formData: any, prop: any, unitData: any) => {
    if (!user) return;

    const registrationCode = `EX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
    const monthlyRent = parseFloat(formData.rent) || 0;
    const advMonths = parseInt(formData.advancePaid) || 0;
    const maxLawfulAdvance = monthlyRent * 6;

    let agreementUrl: string | null = null;
    let voiceUrl: string | null = null;

    // Files can't survive sessionStorage redirect, skip file upload on auto-submit
    if (formData.hasAgreementFile && agreementFile) {
      const path = `existing-agreements/${user.id}/${Date.now()}_${agreementFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(path, agreementFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
        agreementUrl = urlData.publicUrl;
      }
    }

    // Upload voice file or recorded audio blob
    const voiceToUpload = voiceFile || (audioBlob ? new File([audioBlob], `recording_${Date.now()}.${audioBlob.type.includes("mp4") ? "mp4" : audioBlob.type.includes("ogg") ? "ogg" : "webm"}`, { type: audioBlob.type }) : null);
    if ((formData.hasVoiceFile || audioBlob) && voiceToUpload) {
      const path = `existing-voice/${user.id}/${Date.now()}_${voiceToUpload.name}`;
      const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(path, voiceToUpload, { contentType: voiceToUpload.type });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
        voiceUrl = urlData.publicUrl;
      }
    }

    // Determine tenant_user_id
    const matched = formData.matchedTenant;
    const tenantUserId = matched?.userId || user.id; // Use landlord's own ID as placeholder if no match
    const tenantIdCode = matched?.tenantIdCode || `PENDING-${Date.now()}`;

    const { error, data: tenancyData } = await supabase.from("tenancies").insert({
      tenant_user_id: tenantUserId,
      landlord_user_id: user.id,
      unit_id: unitData.id,
      tenant_id_code: tenantIdCode,
      registration_code: registrationCode,
      agreed_rent: monthlyRent,
      advance_months: advMonths,
      start_date: formData.existingStartDate,
      end_date: formData.expiryDate,
      move_in_date: formData.existingStartDate,
      status: "existing_declared",
      tenancy_type: "existing_migration",
      existing_advance_paid: advMonths,
      existing_start_date: formData.existingStartDate,
      existing_agreement_url: agreementUrl,
      existing_voice_url: voiceUrl,
      landlord_accepted: true,
      tenant_accepted: false,
      compliance_status: "under_review",
      tax_compliance_status: "pending",
      rent_card_id: formData.selectedRentCardId || null,
      rent_card_id_2: formData.selectedRentCardId2 || null,
    } as any).select().single();

    if (error) throw error;

    // Generate agreement PDF when "Buy Agreement" is selected
    if (formData.agreementChoice === "buy" && tenancyData) {
      try {
        // Fetch template config
        const { data: tplConfig } = await supabase.from("agreement_template_config").select("*").limit(1).single();
        // Fetch landlord profile for name
        const { data: landlordProfile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).single();

        const pdfData = {
          tenancyId: tenancyData.id,
          registrationCode,
          landlordName: landlordProfile?.full_name || "Landlord",
          tenantName: formData.tenantName,
          tenantId: formData.matchedTenant?.tenantIdCode || "Pending",
          propertyName: prop.property_name || prop.address,
          propertyAddress: prop.address,
          unitName: unitData.unit_name,
          unitType: unitData.unit_type,
          monthlyRent,
          advanceMonths: advMonths,
          startDate: formData.existingStartDate,
          endDate: formData.expiryDate,
          region: prop.region,
          ghanaPostGps: prop.ghana_post_gps || undefined,
          landlordPhone: landlordProfile?.phone || undefined,
          tenantPhone: formData.tenantPhone || undefined,
          isExistingTenancy: formData.agreementChoice !== "buy",
          templateConfig: tplConfig ? {
            max_advance_months: tplConfig.max_advance_months,
            min_lease_duration: tplConfig.min_lease_duration,
            max_lease_duration: tplConfig.max_lease_duration,
            tax_rate: tplConfig.tax_rate,
            registration_deadline_days: tplConfig.registration_deadline_days,
            terms: tplConfig.terms,
          } : undefined,
          landlordSignature: {
            name: landlordProfile?.full_name || "Landlord",
            signedAt: new Date().toISOString(),
            method: "Digital (Auto)",
          },
        };

        const doc = await generateAgreementPdf(pdfData);
        const pdfBlob = doc.output("blob");
        const pdfPath = `generated-agreements/${user.id}/${Date.now()}_${registrationCode}.pdf`;
        const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(pdfPath, pdfBlob, { contentType: "application/pdf" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(pdfPath);
          await supabase.from("tenancies").update({
            agreement_pdf_url: urlData.publicUrl,
            landlord_signed_at: new Date().toISOString(),
          } as any).eq("id", tenancyData.id);
        }
      } catch (pdfErr) {
        console.error("Failed to generate agreement PDF:", pdfErr);
      }
    }

    // Activate rent cards if selected
    if (formData.selectedRentCardId && tenancyData) {
      const cardActivationData = {
        status: "active",
        tenancy_id: tenancyData.id,
        activated_at: new Date().toISOString(),
        tenant_user_id: tenantUserId,
        property_id: prop.id,
        unit_id: unitData.id,
        start_date: formData.existingStartDate,
        expiry_date: formData.expiryDate,
        current_rent: monthlyRent,
        max_advance: maxLawfulAdvance,
        advance_paid: advMonths,
      };

      const updates = [
        supabase.from("rent_cards").update({
          ...cardActivationData,
          card_role: "landlord_copy",
        } as any).eq("id", formData.selectedRentCardId),
      ];
      if (formData.selectedRentCardId2) {
        updates.push(
          supabase.from("rent_cards").update({
            ...cardActivationData,
            card_role: "tenant_copy",
          } as any).eq("id", formData.selectedRentCardId2)
        );
      }
      await Promise.all(updates);
    }

    await supabase.from("units").update({ status: "occupied" }).eq("id", unitData.id);

    // If tenant not matched, create pending_tenant record and send SMS
    if (!matched?.userId) {
      const { data: pendingData } = await supabase.from("pending_tenants").insert({
        full_name: formData.tenantName,
        phone: formData.tenantPhone,
        created_by: user.id,
        tenancy_id: tenancyData?.id || null,
      } as any).select().single();

      // Send SMS invitation
      try {
        await supabase.functions.invoke("send-sms", {
          body: {
            phone: formData.tenantPhone,
            message: `Hello ${formData.tenantName}, your landlord has declared an existing tenancy on RentControlGhana. Please register at https://www.rentcontrolghana.com to view and confirm your tenancy. Ref: ${registrationCode}`,
          },
        });
        // Mark SMS sent
        if (pendingData) {
          await supabase.from("pending_tenants").update({ sms_sent: true } as any).eq("id", pendingData.id);
        }
      } catch {
        console.error("Failed to send SMS invitation");
      }
    }

    // Finalize deferred office attribution for agreement_sale fee
    try {
      const { data: escrowData } = await supabase
        .from("escrow_transactions")
        .select("id, office_id")
        .eq("user_id", user.id)
        .eq("payment_type", "agreement_sale")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Resolve office from property
      const { data: propOffice } = await supabase
        .from("properties")
        .select("office_id")
        .eq("id", prop.id)
        .maybeSingle();

      const resolvedOfficeId = propOffice?.office_id || escrowData?.office_id;
      if (escrowData?.id && resolvedOfficeId) {
        await supabase.functions.invoke("finalize-office-attribution", {
          body: {
            escrow_transaction_id: escrowData.id,
            office_id: resolvedOfficeId,
          },
        });
      }
    } catch (e: any) {
      console.warn("Office attribution deferred:", e.message);
    }

    setCreatedCode(registrationCode);
    setStep("done");
    toast.success("Existing tenancy declared successfully!");
  };

  // Computed total fee based on agreement choice
  const registerFee = existingBand?.register_fee ?? 0;
  const filingFee = existingBand?.filing_fee ?? 0;
  const agreementSaleFee = existingBand?.agreement_fee ?? 0;
  const totalFee = registerFee + filingFee + (agreementChoice === "buy" ? agreementSaleFee : 0);

  const handleSubmit = async () => {
    if (!user || !property || !unit) return;
    if (!tenantName.trim() || !tenantPhone.trim()) {
      toast.error("Please enter tenant name and phone number");
      return;
    }

    const monthlyRent = parseFloat(rent) || 0;

    // If fee is enabled and > 0, redirect to payment
    if (feeEnabled && totalFee > 0) {
      // Save form to sessionStorage
      const formData = {
        selectedPropertyId,
        selectedUnitId,
        tenantName,
        tenantPhone,
        matchedTenant,
        rent,
        advancePaid,
        existingStartDate,
        expiryDate,
        selectedRentCardId,
        selectedRentCardId2,
        hasAgreementFile: !!agreementFile,
        hasVoiceFile: !!voiceFile,
        agreementChoice,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData));

      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("paystack-checkout", {
          body: {
            type: "existing_tenancy_bundle",
            monthlyRent,
            propertyId: property.id,
            agreementChoice,
            callbackPath: "/landlord/declare-existing-tenancy?status=fee_paid",
          },
        });

        if (error) throw error;
        if (data?.skipped) {
          // Fee waived — submit directly
          sessionStorage.removeItem(SESSION_KEY);
          await createTenancyRecord(formData, property, unit);
          return;
        }
        if (data?.authorization_url) {
          if (data?.reference) {
            sessionStorage.setItem("pendingPaymentReference", data.reference);
          }
          window.location.href = data.authorization_url;
          return;
        }
        throw new Error("Failed to initialize payment");
      } catch (err: any) {
        toast.error(err.message || "Payment initialization failed");
        sessionStorage.removeItem(SESSION_KEY);
      } finally {
        setSubmitting(false);
      }
    } else {
      // No fee — submit directly
      setSubmitting(true);
      try {
        const formData = {
          selectedPropertyId,
          selectedUnitId,
          tenantName,
          tenantPhone,
          matchedTenant,
          rent,
          advancePaid,
          existingStartDate,
          expiryDate,
          selectedRentCardId,
          selectedRentCardId2,
          hasAgreementFile: !!agreementFile,
          hasVoiceFile: !!voiceFile,
          agreementChoice,
        };
        await createTenancyRecord(formData, property, unit);
      } catch (err: any) {
        toast.error(err.message || "Failed to declare tenancy");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const monthlyRent = parseFloat(rent) || 0;
  const maxLawfulAdvance = monthlyRent * 6;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/landlord/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Declare Existing Tenancy</h1>
          <p className="text-muted-foreground mt-1">Migrate a tenancy that started before the platform</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {["Select Unit", "Tenant Info", "Tenancy Details", "Agreement", "Review"].map((s, i) => {
          const steps: Step[] = ["select-unit", "find-tenant", "details", "agreement-choice", "review"];
          const currentIdx = steps.indexOf(step === "done" ? "review" : step);
          const isActive = i <= currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-0.5 w-6 ${isActive ? "bg-primary" : "bg-muted"}`} />}
              <span className={`px-2.5 py-1 rounded-full ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}. {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Select Unit */}
      {step === "select-unit" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Unit</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.</p>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Property</Label>
                <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setSelectedUnitId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.property_name || "Unnamed"} — {p.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {property && (
                <div className="space-y-3">
                  <Label>Unit</Label>
                  <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                    <SelectTrigger><SelectValue placeholder="Choose a unit" /></SelectTrigger>
                    <SelectContent>
                      {property.units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.unit_name} — {u.unit_type} (GH₵ {u.monthly_rent.toLocaleString()}/mo)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button disabled={!selectedUnitId} onClick={() => { setRent(unit?.monthly_rent.toString() || ""); setStep("find-tenant"); }}>
                Next: Tenant Info
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Step 2: Tenant Info */}
      {step === "find-tenant" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Tenant Information
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter the tenant's name and phone number. If they have an account, the tenancy will be linked automatically. If not, they'll receive an SMS invitation.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant Full Name</Label>
              <Input
                placeholder="e.g. Kwame Asante"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tenant Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 0241234567"
                  value={tenantPhone}
                  onChange={(e) => { setTenantPhone(e.target.value); setPhoneSearchDone(false); setMatchedTenant(null); }}
                />
                <Button variant="outline" onClick={handlePhoneSearch} disabled={!tenantPhone.trim() || phoneSearching}>
                  <Search className="h-4 w-4 mr-1" />
                  {phoneSearching ? "..." : "Check"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">We'll check if this number is already registered on the platform.</p>
            </div>
          </div>

          {phoneSearchDone && matchedTenant && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div>
                <div className="font-semibold text-card-foreground">{matchedTenant.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {matchedTenant.tenantIdCode ? `Tenant ID: ${matchedTenant.tenantIdCode}` : "User found — will be linked automatically"}
                </div>
              </div>
            </div>
          )}

          {phoneSearchDone && !matchedTenant && (
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 flex items-center gap-3">
              <Phone className="h-5 w-5 text-warning shrink-0" />
              <div>
                <div className="font-semibold text-card-foreground">Tenant not registered</div>
                <div className="text-sm text-muted-foreground">
                  An SMS invitation will be sent to {tenantPhone} after submission. The tenancy will be registered regardless.
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("select-unit")}>Back</Button>
            <Button disabled={!tenantName.trim() || !tenantPhone.trim() || !phoneSearchDone} onClick={() => setStep("details")}>
              Next: Tenancy Details
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Details */}
      {step === "details" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Existing Tenancy Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Rent (GH₵)</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advance Already Paid (months)</Label>
              <Input
                type="number"
                min="0"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                placeholder="e.g. 6"
              />
              <p className="text-xs text-muted-foreground">Enter the number of months already paid as advance for this existing tenancy</p>
            </div>
            <div className="space-y-2">
              <Label>Tenancy Start Date</Label>
              <Input type="date" value={existingStartDate} onChange={(e) => setExistingStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expected Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          {monthlyRent > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly Rent</span><span className="font-semibold">GH₵ {monthlyRent.toLocaleString()}</span></div>
              <div className="flex justify-between text-primary font-semibold"><span>Maximum Lawful Advance (6 months)</span><span>GH₵ {maxLawfulAdvance.toLocaleString()}</span></div>
              {feeEnabled && existingBand && (
                <div className="pt-2 border-t border-primary/10 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Register Tenant Fee</span><span className="font-semibold text-card-foreground">GH₵ {registerFee.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Filing Fee</span><span className="font-semibold text-card-foreground">GH₵ {filingFee.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label>Agreement Upload (optional)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setAgreementFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Upload existing tenancy agreement (PDF or image)</p>
          </div>

          <div className="space-y-3">
            <Label>Voice Message (optional)</Label>
            <div className="flex items-center gap-3">
              {!isRecording && !audioBlob && (
                <Button type="button" variant="outline" size="sm" onClick={startRecording}>
                  <Mic className="h-4 w-4 mr-1" /> Record
                </Button>
              )}
              {isRecording && (
                <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
                  <Square className="h-4 w-4 mr-1" /> Stop
                </Button>
              )}
              {audioBlob && audioUrl && (
                <div className="flex items-center gap-2 flex-1">
                  <audio controls src={audioUrl} className="h-8 flex-1" />
                  <Button type="button" variant="ghost" size="sm" onClick={deleteRecording}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
            {!audioBlob && (
              <>
                <Input type="file" accept="audio/*" onChange={(e) => setVoiceFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">Or upload an existing audio file</p>
              </>
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Label>Assign Rent Cards</Label>
            <p className="text-xs text-muted-foreground">Assign 2 rent cards to this tenancy — one landlord copy and one tenant copy. Both are required.</p>
            {availableRentCards.length < 2 ? (
              <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0" />
                <div>
                  <div className="font-semibold text-card-foreground">Insufficient Rent Cards</div>
                  <div className="text-sm text-muted-foreground">
                    You need at least 2 available rent cards. You currently have {availableRentCards.length}.{" "}
                    <Link to="/landlord/manage-rent-cards" className="text-primary underline">Purchase rent cards</Link>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Landlord Copy</Label>
                  <Select value={selectedRentCardId} onValueChange={(v) => { setSelectedRentCardId(v); if (v === selectedRentCardId2) setSelectedRentCardId2(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select card..." /></SelectTrigger>
                    <SelectContent>
                      {availableRentCards.filter(c => c.id !== selectedRentCardId2).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.serial_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tenant Copy</Label>
                  <Select value={selectedRentCardId2} onValueChange={setSelectedRentCardId2}>
                    <SelectTrigger><SelectValue placeholder="Select card..." /></SelectTrigger>
                    <SelectContent>
                      {availableRentCards.filter(c => c.id !== selectedRentCardId).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.serial_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("find-tenant")}>Back</Button>
            <Button disabled={!rent || monthlyRent <= 0 || !existingStartDate || !expiryDate || !selectedRentCardId || !selectedRentCardId2} onClick={() => setStep("agreement-choice")}>Next: Agreement</Button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Agreement Choice */}
      {step === "agreement-choice" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Agreement Type</h2>
          <p className="text-sm text-muted-foreground">
            Choose how you want to handle the tenancy agreement for this existing tenancy.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setAgreementChoice("upload")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                agreementChoice === "upload"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Upload className="h-5 w-5 text-primary" />
                <span className="font-semibold text-card-foreground">Upload Existing Agreement</span>
              </div>
              <p className="text-xs text-muted-foreground">I already have an agreement document. I'll upload it myself.</p>
            </button>

            <button
              type="button"
              onClick={() => setAgreementChoice("buy")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                agreementChoice === "buy"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold text-card-foreground">Buy Tenancy Agreement</span>
              </div>
              <p className="text-xs text-muted-foreground">The platform generates a standard tenancy agreement for you.</p>
            </button>
          </div>

          {/* Fee Basket */}
          {feeEnabled && existingBand && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2 text-sm">
              <p className="font-semibold text-card-foreground mb-2">Fee Breakdown</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Register Tenant Fee</span>
                <span className="font-semibold">GH₵ {registerFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filing Existing Tenancy Fee</span>
                <span className="font-semibold">GH₵ {filingFee.toFixed(2)}</span>
              </div>
              {agreementChoice === "buy" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agreement Sale Fee</span>
                  <span className="font-semibold">GH₵ {agreementSaleFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold text-card-foreground">
                <span>Total</span>
                <span>GH₵ {totalFee.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("details")}>Back</Button>
            <Button onClick={() => setStep("review")}>Next: Review</Button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Review */}
      {step === "review" && property && unit && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Existing Tenancy Summary
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Property", property.property_name || property.address],
                ["Digital Address", property.ghana_post_gps || "—"],
                ["Unit", `${unit.unit_name} (${unit.unit_type})`],
                ["Tenant Name", tenantName],
                ["Tenant Phone", tenantPhone],
                ["Tenant Status", matchedTenant ? `Registered (${matchedTenant.fullName})` : "Not Registered — SMS will be sent"],
                ["Monthly Rent", `GH₵ ${monthlyRent.toLocaleString()}`],
                ["Advance Paid", `${advancePaid} month(s)`],
                ["Max Lawful Advance", `GH₵ ${maxLawfulAdvance.toLocaleString()}`],
                ["Start Date", new Date(existingStartDate).toLocaleDateString("en-GB")],
                ["Expiry Date", new Date(expiryDate).toLocaleDateString("en-GB")],
                ["Rent Card (Landlord)", availableRentCards.find(c => c.id === selectedRentCardId)?.serial_number || "—"],
                ["Rent Card (Tenant)", availableRentCards.find(c => c.id === selectedRentCardId2)?.serial_number || "—"],
                ["Agreement Type", agreementChoice === "buy" ? "Buy Agreement from Platform" : "Upload Own Agreement"],
                ["Agreement Upload", agreementFile ? agreementFile.name : "None"],
                ["Voice Message", audioBlob ? "Recorded" : voiceFile ? voiceFile.name : "None"],
                ["Status", "Existing Tenancy — Awaiting Verification"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="font-semibold text-card-foreground">{value}</div>
                </div>
              ))}
            </div>

            {feeEnabled && totalFee > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold text-card-foreground mb-1">Fees</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Register Tenant Fee</span><span>GH₵ {registerFee.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filing Fee</span><span>GH₵ {filingFee.toFixed(2)}</span></div>
                {agreementChoice === "buy" && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Agreement Sale Fee</span><span>GH₵ {agreementSaleFee.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-border font-bold"><span>Total</span><span>GH₵ {totalFee.toFixed(2)}</span></div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("agreement-choice")}>Back</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {submitting ? "Processing..." : feeEnabled && totalFee > 0 ? `Pay GH₵ ${totalFee.toFixed(2)} & Submit` : "Declare Existing Tenancy"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-8 shadow-elevated border border-success/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground">Tenancy Declared!</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Your existing tenancy has been declared with temporary ID: <strong className="text-primary">{createdCode}</strong>. It will be verified by Rent Control before activation.
          </p>
          {!matchedTenant && (
            <p className="text-sm text-muted-foreground">An SMS invitation has been sent to the tenant at {tenantPhone}.</p>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/landlord/agreements"><Button variant="outline">View Agreements</Button></Link>
            <Link to="/landlord/dashboard"><Button>Back to Dashboard</Button></Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DeclareExistingTenancy;
