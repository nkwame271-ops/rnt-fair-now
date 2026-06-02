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

const EvidenceImage = ({ value, bucket = "application-evidence", alt = "Evidence", className }: Props) => {
  const [url, setUrl] = useState<string | null>(isHttpUrl(value) ? value : null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    if (isHttpUrl(value)) {
      setUrl(value);
      return;
    }
    // Strip an accidental bucket prefix if present.
    const path = value.startsWith(`${bucket}/`) ? value.slice(bucket.length + 1) : value;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
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
