import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageOff } from "lucide-react";

interface Props {
  /** Either a storage path inside `application-evidence` or a full http(s) URL (legacy rows). */
  value: string;
  bucket?: string;
  alt?: string;
  className?: string;
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

/**
 * Extract a storage path from a legacy public/signed URL like
 * `.../storage/v1/object/public/<bucket>/<path>` or `.../object/sign/<bucket>/<path>?token=...`.
 * Returns null when the URL doesn't match a Supabase storage URL shape.
 */
const extractStoragePath = (url: string, bucket: string): string | null => {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/`;
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    const after = u.pathname.slice(i + marker.length); // e.g. "public/<bucket>/path/file" or "sign/<bucket>/path/file"
    const parts = after.split("/");
    if (parts.length < 3) return null;
    const kind = parts[0]; // public | sign | authenticated
    const urlBucket = parts[1];
    if (urlBucket !== bucket) return null;
    if (!["public", "sign", "authenticated"].includes(kind)) return null;
    return parts.slice(2).join("/");
  } catch {
    return null;
  }
};

const EvidenceImage = ({ value, bucket = "application-evidence", alt = "Evidence", className }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setErrored(false);

    // 1) If the value is an http(s) URL, try to convert it to a signed URL for the private bucket.
    //    Falls back to opening the raw URL only when it doesn't look like a Supabase storage URL
    //    for this bucket (e.g. external image hosting).
    let storagePath: string | null = null;
    if (isHttpUrl(value)) {
      storagePath = extractStoragePath(value, bucket);
      if (!storagePath) {
        setUrl(value);
        return;
      }
    } else {
      // Strip an accidental bucket prefix if present.
      storagePath = value.startsWith(`${bucket}/`) ? value.slice(bucket.length + 1) : value;
    }

    supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.signedUrl) {
          setErrored(true);
        } else {
          setUrl(data.signedUrl);
        }
      });
    return () => {
      alive = false;
    };
  }, [value, bucket]);

  if (errored) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg border border-border text-muted-foreground text-xs ${className || "w-full h-32"}`}>
        <ImageOff className="h-4 w-4 mr-1" /> Unavailable
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg border border-border ${className || "w-full h-32"}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt={alt} className={className || "rounded-lg w-full h-32 object-cover border border-border hover:opacity-80 transition-opacity"} onError={() => setErrored(true)} />
    </a>
  );
};

export default EvidenceImage;
