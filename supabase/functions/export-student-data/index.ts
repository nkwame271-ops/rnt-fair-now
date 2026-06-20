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

// Columns that hold storage paths/URLs we want to sign.
// Format: { table, idCol, pathCols: [{ col, bucket, prefix? }] }
const FILE_SOURCES: Array<{
  table: string;
  pathCols: Array<{ col: string; bucket: string; stripPrefix?: string }>;
}> = [
  { table: "profiles", pathCols: [
    { col: "avatar_url", bucket: "avatars" },
    { col: "student_id_url", bucket: "kyc-documents" },
    { col: "umb_confirmation_screenshot_path", bucket: "kyc-documents" },
  ]},
  { table: "tenancies", pathCols: [
    { col: "agreement_pdf_url", bucket: "agreements" },
    { col: "final_agreement_pdf_url", bucket: "agreements" },
    { col: "existing_agreement_url", bucket: "application-evidence" },
    { col: "existing_voice_url", bucket: "application-evidence" },
  ]},
  { table: "complaint_documents", pathCols: [
    { col: "storage_path", bucket: "complaint-evidence" },
  ]},
  { table: "payment_receipts", pathCols: [
    { col: "pdf_url", bucket: "receipts" },
  ]},
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

async function chunkedIn(svc: any, table: string, col: string, ids: string[], select = "*"): Promise<any[]> {
  if (!ids.length) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data, error } = await svc.from(table).select(select).in(col, slice);
    if (error) throw new Error(`${table}.${col}: ${error.message}`);
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

    // Verify caller is a main super admin
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

    const [
      kyc, ratings_given, ratings_received, residence_history,
      tenant_prefs, viewing_requests, rental_apps, notifications,
      rentcare_apps, complaints, safety_reports,
      support_conversations,
      rent_payments, payment_intents, payment_receipts, payment_fulfillments,
      escrow_tx, signatures, complaint_docs,
    ] = await Promise.all([
      chunkedIn(svc, "kyc_verifications", "user_id", studentIds),
      chunkedIn(svc, "ratings", "rater_user_id", studentIds),
      chunkedIn(svc, "ratings", "ratee_user_id", studentIds),
      chunkedIn(svc, "student_residence_history", "student_user_id", studentIds),
      chunkedIn(svc, "tenant_preferences", "user_id", studentIds),
      chunkedIn(svc, "viewing_requests", "tenant_user_id", studentIds),
      chunkedIn(svc, "rental_applications", "tenant_user_id", studentIds),
      chunkedIn(svc, "notifications", "user_id", studentIds),
      chunkedIn(svc, "rentcare_applications", "applicant_user_id", studentIds),
      chunkedIn(svc, "complaints", "complainant_user_id", studentIds),
      chunkedIn(svc, "safety_reports", "user_id", studentIds),
      chunkedIn(svc, "support_conversations", "user_id", studentIds),
      chunkedIn(svc, "rent_payments", "tenancy_id", tenancyIds),
      chunkedIn(svc, "payment_intents", "user_id", studentIds),
      chunkedIn(svc, "payment_receipts", "user_id", studentIds),
      chunkedIn(svc, "payment_fulfillments", "user_id", studentIds),
      chunkedIn(svc, "escrow_transactions", "user_id", studentIds),
      chunkedIn(svc, "tenancy_signatures", "tenancy_id", tenancyIds),
      chunkedIn(svc, "complaint_documents", "complaint_id", complaintsIdsFrom([])), // refined below
    ]).catch((e) => { throw e; });

    // refine complaint_documents (we needed complaint ids, do it now)
    const complaintIds = (complaints as any[]).map((c) => c.id);
    const complaintDocs = await chunkedIn(svc, "complaint_documents", "complaint_id", complaintIds);
    const escrowIds = (escrow_tx as any[]).map((e: any) => e.id);
    const escrowSplits = await chunkedIn(svc, "escrow_splits", "escrow_transaction_id", escrowIds);
    const supportConvIds = (support_conversations as any[]).map((c: any) => c.id);
    const supportMessages = await chunkedIn(svc, "support_messages", "conversation_id", supportConvIds);

    // 3. Build CSVs
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
      "complaint_documents": complaintDocs,
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

    // 4. Build signed URL manifest for every storage-backed file referenced
    type FileRow = { table: string; record_id: string; column: string; bucket: string; path: string; signed_url: string | null; error?: string };
    const fileManifest: FileRow[] = [];
    const sign = async (bucket: string, path: string) => {
      try {
        const { data, error } = await svc.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
        if (error) return { url: null, err: error.message };
        return { url: data.signedUrl, err: undefined };
      } catch (e: any) { return { url: null, err: e?.message ?? "sign-failed" }; }
    };

    for (const src of FILE_SOURCES) {
      const rows = tables[src.table] ?? [];
      for (const r of rows) {
        for (const { col, bucket } of src.pathCols) {
          const raw = r?.[col];
          if (!raw || typeof raw !== "string") continue;
          // Skip absolute http(s) URLs that aren't storage paths
          if (/^https?:\/\//i.test(raw) && !raw.includes("/storage/v1/object/")) {
            fileManifest.push({ table: src.table, record_id: r.id ?? r.user_id ?? "", column: col, bucket, path: raw, signed_url: raw });
            continue;
          }
          let path = raw;
          // Strip full storage URL prefix if present
          const m = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
          if (m) path = m[2];
          const { url, err } = await sign(bucket, path);
          fileManifest.push({ table: src.table, record_id: r.id ?? r.user_id ?? "", column: col, bucket, path, signed_url: url, error: err });
        }
      }
    }
    zip.file("file_manifest.csv", toCsv(fileManifest));
    zip.file("README.txt",
      `Student Data Export\nGenerated: ${new Date().toISOString()}\nStudents: ${studentIds.length}\nRows: ${totalRows}\nFiles indexed: ${fileManifest.length}\n\n` +
      `Each .csv file is one table. file_manifest.csv contains time-limited (7-day) signed download URLs for every file tied to a student.\n` +
      `Re-run the export to refresh expired URLs.\n`
    );

    // 5. Upload ZIP to data-exports bucket
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

    await svc.from("admin_audit_log").insert({
      actor_user_id: userRes.user.id,
      action: "student_data_export",
      details: { students: studentIds.length, rows: totalRows, files: fileManifest.length, key },
    }).then(() => {}).catch(() => {});

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

function complaintsIdsFrom(_: any[]): string[] { return []; }
