import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface RatingDialogProps {
  tenancyId: string;
  ratedUserId: string;
  ratedUserName: string;
  onRated?: () => void;
}

const RatingDialog = ({ tenancyId, ratedUserId, ratedUserName, onRated }: RatingDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) { toast.error("Please select a rating"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").insert({
        rater_user_id: user.id,
        rated_user_id: ratedUserId,
        tenancy_id: tenancyId,
        rating,
        review: review.trim() || null,
      });
      if (error) {
        if (error.code === "23505") { toast.error("You've already rated this tenancy"); }
        else throw error;
      } else {
        toast.success("Rating submitted!");
        setOpen(false);
        onRated?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Star className="h-4 w-4 mr-1" /> Rate</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rate {ratedUserName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
              >
                <Star className={`h-8 w-8 ${(hover || rating) >= s ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="Write an optional review..." rows={3} />
          <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
            Submit Rating
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
