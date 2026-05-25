import type { ProcessorAdapter } from "./types";
import { createPaystackAdapter } from "./paystack";

/**
 * Server-side registry. The edge function picks an adapter by id; the UI
 * never imports adapters directly so secrets stay on the server.
 */
export type ProcessorId = "paystack";

export function getProcessorAdapter(id: ProcessorId, env: Record<string, string | undefined>): ProcessorAdapter {
  switch (id) {
    case "paystack": {
      const key = env.PAYSTACK_SECRET_KEY;
      if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
      return createPaystackAdapter(key);
    }
    default:
      throw new Error(`Unknown processor: ${id}`);
  }
}

export const SUPPORTED_PROCESSORS: { id: ProcessorId; label: string }[] = [
  { id: "paystack", label: "Paystack" },
];
