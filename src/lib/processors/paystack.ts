import type { ProcessorAdapter } from "./types";

/**
 * Paystack adapter — server-side only. The browser must never see this code
 * with secrets attached; call the `processor-reconciliation` edge function
 * instead. This file exists so the edge function and any future bank/processor
 * implementation share the same shape.
 */
export function createPaystackAdapter(secretKey: string): ProcessorAdapter {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
  const base = "https://api.paystack.co";

  return {
    id: "paystack",
    label: "Paystack",

    async getBalance() {
      const res = await fetch(`${base}/balance`, { headers });
      const j = await res.json();
      const row = Array.isArray(j?.data) ? j.data[0] : j?.data;
      return {
        available: ((row?.balance ?? 0) as number) / 100,
        pending: ((row?.pending ?? 0) as number) / 100,
        currency: row?.currency || "GHS",
      };
    },

    async listSettlements({ from, to }) {
      const url = new URL(`${base}/settlement`);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("perPage", "200");
      const res = await fetch(url.toString(), { headers });
      const j = await res.json();
      const rows: any[] = j?.data || [];
      return rows.map((r) => ({
        id: String(r.id ?? r.reference ?? ""),
        amount: Number(r.total_amount ?? r.amount ?? 0) / 100,
        settled_at: r.settled_at || r.createdAt || r.created_at || "",
        status: r.status || "unknown",
        payout_account: r.settlement_bank || r.account_number || null,
      }));
    },

    async listCollections({ from, to }) {
      const url = new URL(`${base}/transaction`);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("status", "success");
      url.searchParams.set("perPage", "200");
      const res = await fetch(url.toString(), { headers });
      const j = await res.json();
      const rows: any[] = j?.data || [];
      return rows.map((r) => ({
        reference: r.reference,
        amount: Number(r.amount ?? 0) / 100,
        fees: Number(r.fees ?? 0) / 100,
        paid_at: r.paid_at || r.paidAt || r.created_at || "",
        status: r.status || "success",
      }));
    },

    async getNextPayoutEta() {
      // Paystack doesn't expose a forward-looking payout ETA via public API;
      // future processors / banks can override this.
      return null;
    },
  };
}
