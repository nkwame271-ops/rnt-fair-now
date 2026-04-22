import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { Loader2 } from "lucide-react";

interface AudioProps {
  src: string;
  className?: string;
}

export const SignedAudio = ({ src, className }: AudioProps) => {
  const url = useSignedStorageUrl(src);
  if (!url) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 ${className || ""}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Loading audio…
      </div>
    );
  }
  return (
    <audio controls preload="metadata" src={url} className={className || "w-full h-10"}>
      Your browser does not support audio playback.
    </audio>
  );
};

interface ImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export const SignedImage = ({ src, alt, className, onClick }: ImageProps) => {
  const url = useSignedStorageUrl(src);
  if (!url) {
    return <div className={`bg-muted animate-pulse rounded-lg ${className || ""}`} />;
  }
  return <img src={url} alt={alt || ""} className={className} onClick={onClick} />;
};

interface LinkProps {
  src: string;
  children: React.ReactNode;
  className?: string;
}

export const SignedLink = ({ src, children, className }: LinkProps) => {
  const url = useSignedStorageUrl(src);
  return (
    <a href={url || "#"} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
};
