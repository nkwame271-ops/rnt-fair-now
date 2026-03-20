import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Wifi, WifiOff, Clock, AlertTriangle, Phone, RefreshCw } from "lucide-react";

const SMS_TEMPLATES = [
  {
    key: "maintenance",
    label: "Scheduled Maintenance",
    template: "RentGhana: The platform will undergo scheduled maintenance on {date} from {start_time} to {end_time}. Some services may be temporarily unavailable. We apologize for any inconvenience.",
  },
  {
    key: "emergency",
    label: "Emergency Downtime",
    template: "RentGhana: URGENT — The platform is currently experiencing downtime. Our team is working to restore services. We will notify you when resolved.",
  },
  {
    key: "restored",
    label: "Service Restored",
    template: "RentGhana: The platform has been restored and all services are now available. Thank you for your patience.",
  },
  {
    key: "policy",
    label: "Policy Update",
    template: "RentGhana: Important policy update regarding {topic}. Please log in to www.rentcontrolghana.com for details.",
  },
  {
    key: "rent_card",
    label: "Rent Card Reminder",
    template: "RentGhana: Reminder — Please ensure your Rent Card is up to date. Visit www.rentcontrolghana.com or your nearest Rent Control office.",
  },
  {
    key: "general",
    label: "General Announcement",
    template: "RentGhana: {message}",
  },
];

const SmsBroadcast = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [sending, setSending] = useState(false);

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-sms-broadcast", {
        body: { action: "check-balance" },
      });
      if (error) throw error;
      setBalance(data?.balance ?? null);
    } catch (err: any) {
      console.error("Balance check failed:", err);
      toast.error("Failed to check SMS balance");
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const handleTemplateSelect = (key: string) => {
    setSelectedTemplate(key);
    const tpl = SMS_TEMPLATES.find((t) => t.key === key);
    if (tpl) setMessage(tpl.template);
  };

  const getBalanceColor = () => {
    if (balance === null) return "text-muted-foreground";
    if (balance > 500) return "text-emerald-600";
    if (balance >= 100) return "text-amber-600";
    return "text-destructive";
  };

  const getBalanceBg = () => {
    if (balance === null) return "bg-muted";
    if (balance > 500) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
    if (balance >= 100) return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
    return "bg-destructive/10 border-destructive/30";
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    let schedule: string | undefined;
    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) {
        toast.error("Please set both date and time for scheduled send");
        return;
      }
      // Format: YYYY-MM-DD HH:MM AM/PM
      const [hours, minutes] = scheduleTime.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      schedule = `${scheduleDate} ${String(h12).padStart(2, "0")}:${minutes} ${ampm}`;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-sms-broadcast", {
        body: {
          action: "send-broadcast",
          message: message.trim(),
          recipientFilter,
          schedule,
        },
      });
      if (error) throw error;
      toast.success(
        `SMS ${scheduleEnabled ? "scheduled" : "sent"}: ${data.sent} delivered, ${data.failed} failed out of ${data.total} recipients`
      );
      fetchBalance();
    } catch (err: any) {
      console.error("Send failed:", err);
      toast.error("Failed to send broadcast: " + (err.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMS Broadcast Center</h1>
        <p className="text-muted-foreground text-sm">Send system announcements to tenants, landlords, or all users</p>
      </div>

      {/* Balance Widget */}
      <Card className={`border ${getBalanceBg()}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {balance !== null && balance > 0 ? (
                <Wifi className={`h-6 w-6 ${getBalanceColor()}`} />
              ) : (
                <WifiOff className="h-6 w-6 text-destructive" />
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMS Credits</p>
                <p className="text-[10px] text-muted-foreground">1 credit ≈ 1 SMS segment (160 chars)</p>
                <p className={`text-3xl font-bold ${getBalanceColor()}`}>
                  {balanceLoading ? "..." : balance !== null ? balance.toLocaleString() : "N/A"}
                </p>
              </div>
              {balance !== null && balance < 100 && (
                <Badge variant="destructive" className="animate-pulse ml-2">LOW CREDITS</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={fetchBalance} disabled={balanceLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${balanceLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          {balance !== null && balance < 100 && (
            <Alert className="mt-4 border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                <strong>Low SMS credits!</strong> Contact{" "}
                <span className="font-semibold">Center for Financial Literacy, E-Commerce and Digitalization</span>{" "}
                to top up your SMS credits.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Template & Message */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Compose Message</CardTitle>
            <CardDescription>Pick a template or write a custom message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Message Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {SMS_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your SMS message here..."
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {message.length} characters · ~{Math.ceil(message.length / 160)} SMS segment{Math.ceil(message.length / 160) !== 1 ? "s" : ""} per recipient
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Send Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="tenants">Tenants Only</SelectItem>
                  <SelectItem value="landlords">Landlords Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} id="schedule-toggle" />
              <Label htmlFor="schedule-toggle" className="flex items-center gap-1.5 cursor-pointer">
                <Clock className="h-4 w-4" />
                Schedule for later
              </Label>
            </div>

            {scheduleEnabled && (
              <div className="space-y-3 pl-1">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : scheduleEnabled ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Broadcast
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Messages are sent by Center for Financial Literacy, E-Commerce and Digitalization via unique API. Sender ID: "RentGhana". Each SMS segment is up to 160 characters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SmsBroadcast;
