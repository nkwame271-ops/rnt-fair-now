import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Phone, Send, Copy, CheckCircle2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageTransition from "@/components/PageTransition";

interface InviteUserProps {
  /** The role of the person being invited */
  inviteRole: "landlord" | "tenant";
  /** The role of the person doing the inviting */
  senderRole: "tenant" | "landlord";
}

const InviteUser = ({ inviteRole, senderRole }: InviteUserProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const roleLabel = inviteRole === "landlord" ? "Landlord" : "Tenant";
  const registerPath = inviteRole === "landlord" ? "/register/landlord" : "/register/tenant";
  const inviteLink = `${window.location.origin}${registerPath}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join RentGhana as a ${roleLabel}`,
          text: `Hi${name ? ` ${name}` : ""}, I'd like you to register on Rent Control Ghana as a ${roleLabel}. Use this link:`,
          url: inviteLink,
        });
      } catch {
        // user cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSending(true);
    try {
      const message = `Hi${name ? ` ${name}` : ""}, you've been invited to register on Rent Control Ghana as a ${roleLabel}. Sign up here: ${inviteLink}`;

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { phone, message },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setSent(true);
      toast.success(`SMS invitation sent to ${phone}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <UserPlus className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Invite Your {roleLabel}</h1>
          </div>
          <p className="text-muted-foreground">
            Invite your {roleLabel.toLowerCase()} to register on the platform via SMS or a shareable link.
          </p>
        </motion.div>

        {sent && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-3 bg-success/10 border border-success/20 rounded-xl p-4">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-sm">Invitation Sent!</p>
              <p className="text-muted-foreground text-sm">
                An SMS has been sent to <strong>{phone}</strong> with a link to register as a {roleLabel}.
              </p>
            </div>
          </motion.div>
        )}

        {/* SMS Invitation */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-6 shadow-elevated border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Send SMS Invitation
          </h2>
          <form onSubmit={handleSendSms} className="space-y-4">
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                placeholder={`e.g. ${inviteRole === "landlord" ? "Kofi Mensah" : "Ama Owusu"}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="0241234567"
                  className="pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send SMS Invite</>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Shareable Link */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-6 shadow-elevated border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Share Invite Link
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Copy this link and share it with your {roleLabel.toLowerCase()} via WhatsApp, email, or any messaging app.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink} className="text-sm bg-muted/50" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {typeof navigator.share === "function" && (
            <Button variant="outline" className="w-full mt-3" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" /> Share via...
            </Button>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default InviteUser;
