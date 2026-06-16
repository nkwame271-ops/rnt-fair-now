// Super Admin → Google Drive Backup
// Streams every whitelisted public table to CSV and uploads to a timestamped folder in Google Drive.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";
const PAGE_SIZE = 1000;

const TABLES: string[] = [
  // Identity
  "profiles", "user_roles", "admin_staff", "landlords", "tenants", "pending_tenants", "kyc_verifications",
  // Property & tenancy
  "properties", "units", "property_images", "tenancies", "tenancy_signatures",
  "rent_payments", "rent_increase_requests", "rent_assessments",
  // Rent cards
  "rent_cards", "rent_card_serial_stock", "serial_assignments",
  "rent_card_sales_channels", "rent_card_channel_splits",
  // Complaints & cases
  "complaints", "cases", "complaint_decisions", "complaint_hearings",
  "complaint_documents", "complaint_status_history",
  // Finance
  "escrow_transactions", "escrow_splits", "payment_receipts", "payment_intents",
  "payout_transfers", "api_invoices",
  // Regulator
  "offices", "office_allocations", "region_codes", "admin_audit_log",
  // Developer API
  "developer_organizations", "developer_org_members", "api_keys", "api_access_requests",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");
  return rows.length ? `${head}\n${body}\n` : `${head}\n`;
}

async function gatewayFetch(path: string, init: RequestInit, lovableKey: string, gdriveKey: string) {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gdriveKey,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive gateway ${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return res;
}

async function createDriveFolder(name: string, lovableKey: string, gdriveKey: string): Promise<{ id: string; webViewLink: string; name: string }> {
  const res = await gatewayFetch(
    "/drive/v3/files?fields=id,webViewLink,name",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    },
    lovableKey,
    gdriveKey,
  );
  return await res.json();
}

async function uploadCsv(folderId: string, fileName: string, csv: string, lovableKey: string, gdriveKey: string) {
  const boundary = "lovable_boundary_" + crypto.randomUUID();
  const metadata = { name: fileName, parents: [folderId], mimeType: "text/csv" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\n` +
    csv +
    `\r\n--${boundary}--`;
  await gatewayFetch(
    "/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    lovableKey,
    gdriveKey,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string | undefined) ?? null;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify Super Admin
    const { data: isAdmin, error: roleErr } = await admin.rpc("is_main_admin", { _user_id: userId });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — Super Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify connector secrets
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const gdriveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!lovableKey || !gdriveKey) {
      return new Response(
        JSON.stringify({
          error: "Google Drive is not connected. Open the Backups page and click 'Connect Google Drive'.",
          code: "drive_not_connected",
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create log row
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const folderName = `RentControlGhana-Backup-${stamp}`;

    const { data: logRow, error: logErr } = await admin
      .from("system_backup_log")
      .insert({
        triggered_by: userId,
        triggered_by_email: userEmail,
        status: "running",
        drive_folder_name: folderName,
        tables_included: TABLES,
        current_table: null,
        progress_percent: 0,
      })
      .select("id")
      .single();
    if (logErr) throw logErr;
    const logId = logRow.id as string;

    // Run backup in background so client can poll
    const runBackup = async () => {
      try {
        const folder = await createDriveFolder(folderName, lovableKey, gdriveKey);
        await admin.from("system_backup_log").update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.webViewLink,
        }).eq("id", logId);

        const rowCounts: Record<string, number> = {};
        let totalRows = 0;
        const failures: string[] = [];

        for (let i = 0; i < TABLES.length; i++) {
          const table = TABLES[i];
          await admin.from("system_backup_log").update({
            current_table: table,
            progress_percent: Math.round((i / TABLES.length) * 100),
          }).eq("id", logId);

          try {
            let from = 0;
            let headers: string[] = [];
            let csvChunks: string[] = [];
            let tableRows = 0;
            while (true) {
              const { data, error } = await admin
                .from(table)
                .select("*")
                .range(from, from + PAGE_SIZE - 1);
              if (error) throw error;
              if (!data || data.length === 0) break;
              if (headers.length === 0) headers = Object.keys(data[0]);
              csvChunks.push(rowsToCsv(data, headers));
              tableRows += data.length;
              if (data.length < PAGE_SIZE) break;
              from += PAGE_SIZE;
            }
            if (headers.length === 0) {
              // empty table — still upload header-only file if we can introspect; skip otherwise
              csvChunks.push("(empty)\n");
            }
            const csv = csvChunks.join("");
            await uploadCsv(folder.id, `${table}.csv`, csv, lovableKey, gdriveKey);
            rowCounts[table] = tableRows;
            totalRows += tableRows;
          } catch (e) {
            console.error(`[backup] table ${table} failed:`, e);
            failures.push(`${table}: ${(e as Error).message}`);
          }
        }

        // Manifest
        const manifest = {
          generated_at: new Date().toISOString(),
          triggered_by: userEmail,
          folder_name: folderName,
          tables: TABLES,
          row_counts: rowCounts,
          total_rows: totalRows,
          failures,
        };
        await uploadCsv(folder.id, "manifest.json", JSON.stringify(manifest, null, 2), lovableKey, gdriveKey);

        await admin.from("system_backup_log").update({
          status: failures.length === 0 ? "success" : "partial",
          finished_at: new Date().toISOString(),
          row_counts: rowCounts,
          total_rows: totalRows,
          progress_percent: 100,
          current_table: null,
          error_message: failures.length ? failures.join(" | ") : null,
        }).eq("id", logId);
      } catch (e) {
        console.error("[backup] fatal:", e);
        await admin.from("system_backup_log").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: (e as Error).message,
        }).eq("id", logId);
      }
    };

    // Fire and forget
    // @ts-ignore EdgeRuntime is provided by Deno Deploy
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runBackup());
    } else {
      runBackup();
    }

    return new Response(JSON.stringify({ ok: true, log_id: logId, folder_name: folderName }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backup-to-drive] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
