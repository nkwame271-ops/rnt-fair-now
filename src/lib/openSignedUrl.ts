import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/hooks/useSignedStorageUrl";

const PUBLIC_BUCKETS = new Set(["property-images", "avatars"]);

/**
 * Open a Supabase Storage URL in a new tab. If the URL points to a private bucket,
 * generates a signed URL first so the request doesn't 404 with "Bucket not found".
 */
export const openSignedStorageUrl = async (url: string): Promise<void> => {
  if (!url) return;
  const parsed = parseStorageUrl(url);
  if (!parsed || PUBLIC_BUCKETS.has(parsed.bucket)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 3600);
  if (error || !data?.signedUrl) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};
