import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Parse a Supabase storage URL into { bucket, path }.
 * Handles both legacy "/object/public/<bucket>/<path>" and "/object/<bucket>/<path>" forms.
 * Returns null when the URL is not a Supabase storage URL.
 */
export const parseStorageUrl = (url: string): { bucket: string; path: string } | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Drop any "?token=..." (signed URLs) — we re-sign anyway
    const segments = u.pathname.split("/").filter(Boolean);
    // Forms:
    //  /storage/v1/object/public/<bucket>/<path...>
    //  /storage/v1/object/sign/<bucket>/<path...>
    //  /storage/v1/object/<bucket>/<path...>
    const objIdx = segments.indexOf("object");
    if (objIdx === -1) return null;
    let rest = segments.slice(objIdx + 1);
    if (rest[0] === "public" || rest[0] === "sign" || rest[0] === "authenticated") {
      rest = rest.slice(1);
    }
    if (rest.length < 2) return null;
    const bucket = rest[0];
    const path = rest.slice(1).join("/");
    return { bucket, path };
  } catch {
    return null;
  }
};

// Buckets that are public — no signing needed
const PUBLIC_BUCKETS = new Set(["property-images", "avatars"]);

/**
 * Returns a usable URL for the given storage URL, refreshing every 50 minutes.
 * - For public buckets, returns the URL unchanged.
 * - For private buckets, generates a fresh signed URL (1 hour TTL).
 */
export const useSignedStorageUrl = (url: string | null | undefined): string | null => {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setResolved(null); return; }
    const parsed = parseStorageUrl(url);
    if (!parsed) { setResolved(url); return; }
    if (PUBLIC_BUCKETS.has(parsed.bucket)) { setResolved(url); return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 3600);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        // Fall back to the original URL — may still work for the uploader
        setResolved(url);
      } else {
        setResolved(data.signedUrl);
      }
      timer = setTimeout(refresh, 50 * 60 * 1000);
    };

    refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url]);

  return resolved;
};
