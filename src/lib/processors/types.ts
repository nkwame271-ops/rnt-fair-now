/**
 * Generic processor / bank adapter interface. Implementations live alongside
 * (e.g. paystack.ts) and are surfaced through `registry.ts`. The same shape
 * must work for Paystack today and any future processor or bank API.
 */

export interface ProcessorBalance {
  available: number; // in GHS (major units)
  pending: number;
  currency: string;
}

export interface ProcessorSettlement {
  id: string;
  amount: number;
  settled_at: string;
  status: string;
  payout_account?: string | null;
}

export interface ProcessorCollection {
  reference: string;
  amount: number;
  fees: number;
  paid_at: string;
  status: string;
}

export interface ProcessorAdapter {
  id: string;
  label: string;
  getBalance(): Promise<ProcessorBalance>;
  listSettlements(range: { from: string; to: string }): Promise<ProcessorSettlement[]>;
  listCollections(range: { from: string; to: string }): Promise<ProcessorCollection[]>;
  getNextPayoutEta?(): Promise<{ expected_at: string; amount: number } | null>;
}

export interface ReconciliationPartition {
  recipient: string;       // canonical recipient key, e.g. "rent_control", "platform"
  label: string;           // human label, e.g. "IGF (Office)"
  due: number;             // unsettled total per platform ledger
  settled: number;         // amount already paid out per processor
  remaining: number;       // due - settled
}

export interface ReconciliationResponse {
  processor: string;
  balance: ProcessorBalance | null;
  total_collected: number;
  total_settled: number;
  next_payout: { expected_at: string; amount: number } | null;
  partitions: ReconciliationPartition[];
  discrepancies: Array<{ recipient: string; ledger: number; processor: number; delta: number }>;
  generated_at: string;
}
