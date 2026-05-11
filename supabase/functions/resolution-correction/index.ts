// Super-admin manual correction dispatcher.
// Validates caller is super admin, performs requested correction, writes audit log,
// and notifies the reporter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyUrl } from "../_shared/project-domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid auth" }, 401);
    const adminId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: adminId });
    if (!isSuper) return json({ error: "Forbidden — Super Admin only" }, 403);

    const body = await req.json();
    const { issue_id, correction_type, reason, target_id, payload } = body || {};
    if (!correction_type || !reason || reason.trim().length < 5) {
      return json({ error: "correction_type and reason (min 5 chars) required" }, 400);
    }

    let before: any = null;
    let after: any = null;
    let target_table: string | null = null;
    let result: any = {};

    switch (correction_type) {
      case "provision_rent_cards": {
        // payload: { escrow_id }
        const escrowId = payload?.escrow_id || target_id;
        if (!escrowId) return json({ error: "escrow_id required" }, 400);
        target_table = "rent_cards";
        const { data: beforeCards } = await admin.from("rent_cards").select("id").eq("escrow_transaction_id", escrowId);
        before = { existing_count: beforeCards?.length ?? 0 };
        const { data: rep, error: repErr } = await admin.rpc("repair_rent_cards_for_escrow", { p_escrow_id: escrowId });
        if (repErr) throw repErr;
        const { data: afterCards } = await admin.from("rent_cards").select("id").eq("escrow_transaction_id", escrowId);
        after = { total_count: afterCards?.length ?? 0, ...rep };
        result = rep;
        break;
      }
      case "mark_complaint_payment_paid": {
        const complaintId = payload?.complaint_id || target_id;
        if (!complaintId) return json({ error: "complaint_id required" }, 400);
        target_table = "complaints";
        const { data: bRow } = await admin.from("complaints").select("id,payment_status,status").eq("id", complaintId).maybeSingle();
        before = bRow;
        const { data: upd } = await admin.from("complaints")
          .update({ payment_status: "paid", status: "ready_for_scheduling" })
          .eq("id", complaintId).select().maybeSingle();
        if (!upd) {
          const { data: bLL } = await admin.from("landlord_complaints").select("id,payment_status,status").eq("id", complaintId).maybeSingle();
          before = bLL;
          await admin.from("landlord_complaints").update({ payment_status: "paid", status: "ready_for_scheduling" }).eq("id", complaintId);
          target_table = "landlord_complaints";
        }
        const { data: aRow } = await admin.from(target_table).select("id,payment_status,status").eq("id", complaintId).maybeSingle();
        after = aRow;
        break;
      }
      case "regenerate_receipt": {
        const escrowId = payload?.escrow_id || target_id;
        if (!escrowId) return json({ error: "escrow_id required" }, 400);
        target_table = "payment_receipts";
        const { data: existing } = await admin.from("payment_receipts").select("id").eq("escrow_transaction_id", escrowId).maybeSingle();
        before = { existing_receipt_id: existing?.id || null };
        if (!existing) {
          const { data: esc } = await admin.from("escrow_transactions").select("*").eq("id", escrowId).maybeSingle();
          if (!esc) return json({ error: "Escrow not found" }, 404);
          const { data: profile } = await admin.from("profiles").select("full_name,email").eq("user_id", esc.user_id).maybeSingle();
          const { data: rcpt } = await admin.from("payment_receipts").insert({
            escrow_transaction_id: escrowId,
            user_id: esc.user_id,
            payer_name: profile?.full_name || "Customer",
            payer_email: profile?.email || "",
            total_amount: esc.total_amount,
            payment_type: esc.payment_type,
            description: `Receipt regenerated by Super Admin — ${reason}`,
            qr_code_data: verifyUrl(`/verify/receipt/${esc.reference}`),
            status: "active",
            tenancy_id: esc.related_tenancy_id || null,
          }).select().single();
          after = { receipt_id: rcpt?.id };
          result = { created: true, receipt_id: rcpt?.id };
        } else {
          after = before;
          result = { created: false, already_exists: true };
        }
        break;
      }
      case "update_dashboard_status": {
        // payload: { table, id, updates }
        const tbl = payload?.table;
        const id = payload?.id;
        const updates = payload?.updates;
        if (!tbl || !id || !updates) return json({ error: "table, id, updates required" }, 400);
        const allowedTables = ["tenancies", "rent_cards", "complaints", "landlord_complaints", "properties", "rent_payments"];
        if (!allowedTables.includes(tbl)) return json({ error: "Table not allowed for manual correction" }, 400);
        target_table = tbl;
        const { data: bRow } = await admin.from(tbl).select("*").eq("id", id).maybeSingle();
        before = bRow;
        const { data: aRow, error: updErr } = await admin.from(tbl).update(updates).eq("id", id).select().maybeSingle();
        if (updErr) throw updErr;
        after = aRow;
        break;
      }
      case "free_form_note": {
        target_table = payload?.table || null;
        before = null;
        after = { note: payload?.note || "" };
        break;
      }
      default:
        return json({ error: `Unknown correction_type: ${correction_type}` }, 400);
    }

    // Audit log
    await admin.from("issue_correction_log").insert({
      issue_id: issue_id || null,
      admin_user_id: adminId,
      correction_type,
      target_table,
      target_id: target_id ? String(target_id) : null,
      before_state: before,
      after_state: after,
      reason,
    });

    // Optionally update issue
    if (issue_id) {
      await admin.from("issue_reports").update({
        status: "under_review",
        assigned_admin_id: adminId,
      }).eq("id", issue_id);

      const { data: rep } = await admin.from("issue_reports").select("reporter_user_id,ticket_number").eq("id", issue_id).maybeSingle();
      if (rep?.reporter_user_id) {
        await admin.from("notifications").insert({
          user_id: rep.reporter_user_id,
          title: "Issue Update",
          body: `Super Admin applied a correction to your report ${rep.ticket_number}. Check the Resolution thread for details.`,
          link: "/",
        });
      }
    }

    return json({ success: true, result });
  } catch (err: any) {
    console.error("[resolution-correction]", err);
    return json({ error: err?.message || "Server error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
