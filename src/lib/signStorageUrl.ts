import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/hooks/useSignedStorageUrl";

const PUBLIC_BUCKETS = new Set(["property-images", "avatars"]);

/**
 * Resolve a Supabase storage URL (or raw "<bucket>/<path>" / "<path>" inside a known bucket)
 * to a usable URL. For private buckets, returns a signed URL with the given TTL.
 * Falls back to the original input on failure.
 */
export const signStorageUrl = async (
  input: string,
  ttlSeconds = 60 * 60 * 24 * 7
): Promise<string> => {
  if (!input) return input;
  const parsed = parseStorageUrl(input);
  if (!parsed) return input;
  if (PUBLIC_BUCKETS.has(parsed.bucket)) return input;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, ttlSeconds);
  if (error || !data?.signedUrl) return input;
  return data.signedUrl;
};

export const signStorageUrls = async (
  urls: string[],
  ttlSeconds?: number
): Promise<string[]> => Promise.all((urls || []).map((u) => signStorageUrl(u, ttlSeconds)));
