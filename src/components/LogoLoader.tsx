import rcdLogo from "@/assets/rcd-logo.png";

interface LogoLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

const LogoLoader = ({ message, size = "md" }: LogoLoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative bg-white rounded-2xl p-3 shadow-lg">
          <img
            src={rcdLogo}
            alt="Loading..."
            className={`${sizeClasses[size]} object-contain animate-pulse`}
          />
        </div>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
};

export default LogoLoader;
