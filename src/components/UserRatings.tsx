import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserRatingsProps {
  userId: string;
}

interface Rating {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  rater_name: string;
}

const UserRatings = ({ userId }: UserRatingsProps) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [avg, setAvg] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("ratings")
        .select("*")
        .eq("rated_user_id", userId)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) { setLoading(false); return; }

      const raterIds = [...new Set(data.map(r => r.rater_user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", raterIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      setRatings(data.map(r => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        created_at: r.created_at,
        rater_name: nameMap.get(r.rater_user_id) || "Anonymous",
      })));
      setAvg(data.reduce((s, r) => s + r.rating, 0) / data.length);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (ratings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-4 w-4 ${avg >= s ? "fill-primary text-primary" : avg >= s - 0.5 ? "fill-primary/50 text-primary" : "text-muted-foreground"}`} />
          ))}
        </div>
        <span className="text-sm font-semibold text-foreground">{avg.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({ratings.length} review{ratings.length !== 1 ? "s" : ""})</span>
      </div>
      {ratings.slice(0, 3).map(r => (
        <div key={r.id} className="text-sm">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`h-3 w-3 ${r.rating >= s ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">by {r.rater_name}</span>
          </div>
          {r.review && <p className="text-xs text-muted-foreground mt-0.5">{r.review}</p>}
        </div>
      ))}
    </div>
  );
};

export default UserRatings;
