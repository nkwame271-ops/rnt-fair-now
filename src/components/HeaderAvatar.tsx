import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  profilePath: string;
}

const HeaderAvatar = ({ profilePath }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setName((data?.full_name as string) || user.email || "");
      setUrl((data?.avatar_url as string) || null);
    })();
  }, [user]);

  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      to={profilePath}
      className="shrink-0 flex items-center gap-2 hover:opacity-90"
      aria-label="Open my profile"
    >
      <Avatar className="h-8 w-8 border border-border">
        {url ? <AvatarImage src={url} alt={name} /> : null}
        <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
          {initials || "•"}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
};

export default HeaderAvatar;
