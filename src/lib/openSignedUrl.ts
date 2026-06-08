import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/hooks/useSignedStorageUrl";

const PUBLIC_BUCKETS = new Set(["property-images", "avatars"]);

// Buckets we know about — used when a raw storage path (no http URL) is provided
// and we need to guess which bucket it belongs to. Order matters: longest/most-specific prefixes first.
const PRIVATE_BUCKET_PATH_HINTS: Array<{ bucket: string; prefixes: string[] }> = [
  { bucket: "form-outputs", prefixes: ["complaints/", "form-outputs/"] },
  { bucket: "application-evidence", prefixes: ["signed-agreements/", "agreements/", "evidence/", "rent-increase/"] },
];
const DEFAULT_PRIVATE_BUCKET = "application-evidence";

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

/**
 * Open a Supabase Storage URL (or raw storage path) in a new tab. Generates a signed URL
 * for private buckets so it doesn't 404 with "Bucket not found".
 * Pass `bucketOverride` when you know which private bucket the raw path belongs to.
 */
export const openSignedStorageUrl = async (url: string, bucketOverride?: string): Promise<void> => {
  if (!url) return;

  let bucket: string | null = null;
  let path: string | null = null;

  if (isHttpUrl(url)) {
    const parsed = parseStorageUrl(url);
    if (!parsed) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    bucket = parsed.bucket;
    path = parsed.path;
  } else {
    // Raw storage path stored without the bucket prefix — guess the bucket from path hints.
    const clean = url.replace(/^\/+/, "");
    if (bucketOverride) {
      bucket = bucketOverride;
    } else {
      const hint = PRIVATE_BUCKET_PATH_HINTS.find(h => h.prefixes.some(p => clean.startsWith(p)));
      bucket = hint?.bucket || DEFAULT_PRIVATE_BUCKET;
    }
    path = clean;
  }

  if (PUBLIC_BUCKETS.has(bucket)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};
