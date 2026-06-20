// Super-admin only: export every record tied to student users
// into a ZIP of CSV files plus a signed-URL manifest for their files.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// Scalar (string) columns holding storage paths or full URLs we want signed.
const FILE_SOURCES: Array<{ table: string; cols: Array<{ col: string; bucket: string }> }> = [
  { table: "profiles", cols: [
    { col: "avatar_url", bucket: "avatars" },
    { col: "student_id_url", bucket: "kyc-documents" },
    { col: "umb_confirmation_screenshot_path", bucket: "kyc-documents" },
  ]},
  { table: "kyc_verifications", cols: [
    { col: "ghana_card_front_url", bucket: "kyc-documents" },
    { col: "ghana_card_back_url", bucket: "kyc-documents" },
    { col: "selfie_url", bucket: "kyc-documents" },
  ]},
  { table: "tenancies", cols: [
    { col: "agreement_pdf_url", bucket: "agreements" },
    { col: "final_agreement_pdf_url", bucket: "agreements" },
    { col: "existing_agreement_url", bucket: "application-evidence" },
    { col: "existing_voice_url", bucket: "application-evidence" },
  ]},
  { table: "complaints", cols: [
    { col: "audio_url", bucket: "complaint-evidence" },
  ]},
  { table: "rentcare_applications", cols: [
    { col: "umb_confirmation_screenshot_path", bucket: "kyc-documents" },
  ]},
];

// Array<string> columns (signed individually)
const FILE_ARRAY_SOURCES: Array<{ table: string; col: string; bucket: string }> = [
  { table: "complaints", col: "evidence_urls", bucket: "complaint-evidence" },
  { table: "safety_reports", col: "evidence_urls", bucket: "safety-evidence" },
];

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((s: Set<string>, r) => { Object.keys(r ?? {}).forEach((k) => s.add(k)); return s; }, new Set<string>())
  );
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

async function chunkedIn(svc: any, table: string, col: string, ids: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data, error } = await svc.from(table).select("*").in(col, slice);
    if (error) { console.warn(`skip ${table}.${col}: ${error.message}`); return out; }
    if (data) out.push(...data);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMain, error: rpcErr } = await svc.rpc("is_main_admin", { _user_id: userRes.user.id });
    if (rpcErr || !isMain) {
      return new Response(JSON.stringify({ error: "Super admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Find all student users
    const { data: students, error: sErr } = await svc.from("profiles").select("*").eq("user_type", "student");
    if (sErr) throw sErr;
    const studentIds = (students ?? []).map((p: any) => p.user_id).filter(Boolean);
    if (!studentIds.length) {
      return new Response(JSON.stringify({ error: "No student users found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Pull everything tied to them
    const tenants = await chunkedIn(svc, "tenants", "user_id", studentIds);
    const tenancies = await chunkedIn(svc, "tenancies", "tenant_user_id", studentIds);
    const tenancyIds = tenancies.map((t: any) => t.id);
    const complaints = await chunkedIn(svc, "complaints", "complainant_user_id", studentIds);
    const escrow_tx = await chunkedIn(svc, "escrow_transactions", "user_id", studentIds);
    const support_conversations = await chunkedIn(svc, "support_conversations", "user_id", studentIds);

    const [
      kyc, ratings_given, ratings_received, residence_history,
      tenant_prefs, viewing_requests, rental_apps, notifications,
      rentcare_apps, safety_reports,
      rent_payments, payment_intents, payment_receipts, payment_fulfillments,
      signatures, escrowSplits, supportMessages,
    ] = await Promise.all([
      chunkedIn(svc, "kyc_verifications", "user_id", studentIds),
      chunkedIn(svc, "ratings", "rater_user_id", studentIds),
      chunkedIn(svc, "ratings", "rated_user_id", studentIds),
      chunkedIn(svc, "student_residence_history", "tenant_user_id", studentIds),
      chunkedIn(svc, "tenant_preferences", "tenant_user_id", studentIds),
      chunkedIn(svc, "viewing_requests", "tenant_user_id", studentIds),
      chunkedIn(svc, "rental_applications", "tenant_user_id", studentIds),
      chunkedIn(svc, "notifications", "user_id", studentIds),
      chunkedIn(svc, "rentcare_applications", "applicant_user_id", studentIds),
      chunkedIn(svc, "safety_reports", "user_id", studentIds),
      chunkedIn(svc, "rent_payments", "tenancy_id", tenancyIds),
      chunkedIn(svc, "payment_intents", "user_id", studentIds),
      chunkedIn(svc, "payment_receipts", "user_id", studentIds),
      chunkedIn(svc, "payment_fulfillments", "user_id", studentIds),
      chunkedIn(svc, "tenancy_signatures", "tenancy_id", tenancyIds),
      chunkedIn(svc, "escrow_splits", "escrow_transaction_id", escrow_tx.map((e: any) => e.id)),
      chunkedIn(svc, "support_messages", "conversation_id", support_conversations.map((c: any) => c.id)),
    ]);

    const tables: Record<string, any[]> = {
      "profiles": students!,
      "tenants": tenants,
      "tenancies": tenancies,
      "kyc_verifications": kyc,
      "ratings_given": ratings_given,
      "ratings_received": ratings_received,
      "student_residence_history": residence_history,
      "tenant_preferences": tenant_prefs,
      "viewing_requests": viewing_requests,
      "rental_applications": rental_apps,
      "notifications": notifications,
      "rentcare_applications": rentcare_apps,
      "complaints": complaints,
      "safety_reports": safety_reports,
      "support_conversations": support_conversations,
      "support_messages": supportMessages,
      "rent_payments": rent_payments,
      "payment_intents": payment_intents,
      "payment_receipts": payment_receipts,
      "payment_fulfillments": payment_fulfillments,
      "escrow_transactions": escrow_tx,
      "escrow_splits": escrowSplits,
      "tenancy_signatures": signatures,
    };

    const zip = new JSZip();
    let totalRows = 0;
    for (const [name, rows] of Object.entries(tables)) {
      zip.file(`${name}.csv`, toCsv(rows));
      totalRows += rows.length;
    }

    // Signed URL manifest
    type FileRow = { table: string; record_id: string; column: string; bucket: string; path: string; signed_url: string | null; error?: string };
    const fileManifest: FileRow[] = [];

    const sign = async (bucket: string, raw: string): Promise<{ path: string; url: string | null; err?: string }> => {
      if (!raw) return { path: raw, url: null, err: "empty" };
      // External URL — pass through unchanged
      if (/^https?:\/\//i.test(raw) && !raw.includes("/storage/v1/object/")) {
        return { path: raw, url: raw };
      }
      let path = raw;
      const m = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
      if (m) { bucket = m[1]; path = m[2]; }
      try {
        const { data, error } = await svc.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
        if (error) return { path, url: null, err: error.message };
        return { path, url: data.signedUrl };
      } catch (e: any) { return { path, url: null, err: e?.message ?? "sign-failed" }; }
    };

    for (const src of FILE_SOURCES) {
      const rows = tables[src.table] ?? [];
      for (const r of rows) {
        for (const { col, bucket } of src.cols) {
          const raw = r?.[col];
          if (!raw || typeof raw !== "string") continue;
          const res = await sign(bucket, raw);
          fileManifest.push({ table: src.table, record_id: r.id ?? r.user_id ?? "", column: col, bucket, path: res.path, signed_url: res.url, error: res.err });
        }
      }
    }
    for (const src of FILE_ARRAY_SOURCES) {
      const rows = tables[src.table] ?? [];
      for (const r of rows) {
        const arr = r?.[src.col];
        if (!Array.isArray(arr)) continue;
        for (const raw of arr) {
          if (typeof raw !== "string" || !raw) continue;
          const res = await sign(src.bucket, raw);
          fileManifest.push({ table: src.table, record_id: r.id ?? "", column: src.col, bucket: src.bucket, path: res.path, signed_url: res.url, error: res.err });
        }
      }
    }
    zip.file("file_manifest.csv", toCsv(fileManifest));
    zip.file("README.txt",
      `Student Data Export\n` +
      `Generated: ${new Date().toISOString()}\n` +
      `Students: ${studentIds.length}\n` +
      `Total rows across tables: ${totalRows}\n` +
      `Files indexed: ${fileManifest.length}\n\n` +
      `Each .csv is one table (one file per table).\n` +
      `file_manifest.csv lists every file (avatars, Ghana cards, agreements, receipts, evidence, etc.)\n` +
      `with a time-limited signed download URL valid for 7 days.\n` +
      `Re-run the export to refresh expired links.\n`
    );

    // Upload ZIP
    const blob = await zip.generateAsync({ type: "uint8array" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `students/${stamp}-students-export.zip`;
    const up = await svc.storage.from("data-exports").upload(key, blob, {
      contentType: "application/zip", upsert: false,
    });
    if (up.error) throw up.error;

    const { data: signed, error: signErr } = await svc.storage
      .from("data-exports").createSignedUrl(key, 60 * 60 * 24 * 7);
    if (signErr) throw signErr;

    try {
      await svc.from("admin_audit_log").insert({
        actor_user_id: userRes.user.id,
        action: "student_data_export",
        details: { students: studentIds.length, rows: totalRows, files: fileManifest.length, key },
      });
    } catch (_) { /* audit best-effort */ }

    return new Response(JSON.stringify({
      ok: true,
      students: studentIds.length,
      rows: totalRows,
      files: fileManifest.length,
      download_url: signed.signedUrl,
      expires_in_days: 7,
      storage_key: key,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("export-student-data error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
