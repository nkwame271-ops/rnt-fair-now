import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Wifi, WifiOff, Clock, AlertTriangle, RefreshCw, Search, X, Loader2, Users } from "lucide-react";

const SMS_TEMPLATES = [
  {
    key: "maintenance",
    label: "Scheduled Maintenance",
    template: "RentControl: The platform will undergo scheduled maintenance on {date} from {start_time} to {end_time}. Some services may be temporarily unavailable. We apologize for any inconvenience.",
  },
  {
    key: "emergency",
    label: "Emergency Downtime",
    template: "RentControl: URGENT — The platform is currently experiencing downtime. Our team is working to restore services. We will notify you when resolved.",
  },
  {
    key: "restored",
    label: "Service Restored",
    template: "RentControl: The platform has been restored and all services are now available. Thank you for your patience.",
  },
  {
    key: "policy",
    label: "Policy Update",
    template: "RentControl: Important policy update regarding {topic}. Please log in to www.rentcontrolghana.com for details.",
  },
  {
    key: "rent_card",
    label: "Rent Card Reminder",
    template: "RentControl: Reminder — Please ensure your Rent Card is up to date. Visit www.rentcontrolghana.com or your nearest Rent Control office.",
  },
  {
    key: "general",
    label: "General Announcement",
    template: "RentControl: {message}",
  },
];

type FoundUser = {
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  role: string | null;
};

const MAX_SELECTED = 50;

const SmsBroadcast = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [targetingMode, setTargetingMode] = useState<"audience" | "specific">("audience");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [sending, setSending] = useState(false);

  // User search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<FoundUser[]>([]);
  const debounceRef = useRef<number | null>(null);

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-sms-broadcast", {
        body: { action: "check-balance" },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Failed");
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

  // Debounced user search
  useEffect(() => {
    if (targetingMode !== "specific") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-sms-broadcast", {
          body: { action: "search-users", q: term, limit: 25 },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.error || "Search failed");
        setSearchResults(data?.users || []);
      } catch (err: any) {
        console.error("User search failed:", err);
        toast.error("Search failed: " + (err.message || "Unknown error"));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchTerm, targetingMode]);

  const handleTemplateSelect = (key: string) => {
    setSelectedTemplate(key);
    const tpl = SMS_TEMPLATES.find((t) => t.key === key);
    if (tpl) setMessage(tpl.template);
  };

  const toggleSelectUser = (u: FoundUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((p) => p.user_id === u.user_id);
      if (exists) return prev.filter((p) => p.user_id !== u.user_id);
      if (prev.length >= MAX_SELECTED) {
        toast.error(`You can select at most ${MAX_SELECTED} users at once.`);
        return prev;
      }
      return [...prev, u];
    });
  };

  const removeSelected = (id: string) => {
    setSelectedUsers((prev) => prev.filter((p) => p.user_id !== id));
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
    if (targetingMode === "specific" && selectedUsers.length === 0) {
      toast.error("Pick at least one user to message");
      return;
    }

    let schedule: string | undefined;
    if (scheduleEnabled) {
      if (!scheduleDate || !scheduleTime) {
        toast.error("Please set both date and time for scheduled send");
        return;
      }
      const [hours, minutes] = scheduleTime.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      schedule = `${scheduleDate} ${String(h12).padStart(2, "0")}:${minutes} ${ampm}`;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        action: "send-broadcast",
        message: message.trim(),
        schedule,
      };
      if (targetingMode === "specific") {
        payload.userIds = selectedUsers.map((u) => u.user_id);
      } else {
        payload.recipientFilter = recipientFilter;
      }

      const { data, error } = await supabase.functions.invoke("admin-sms-broadcast", { body: payload });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Broadcast failed");

      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      const total = data?.total ?? 0;
      const failures: Array<{ phone: string; reason: string }> = data?.failures || [];

      if (total === 0) {
        toast.warning("No valid phone numbers found for the selected recipients.");
      } else if (failed === 0) {
        toast.success(`SMS ${scheduleEnabled ? "scheduled" : "sent"} to ${sent} recipient${sent === 1 ? "" : "s"}.`);
      } else {
        toast.warning(`Delivered ${sent}/${total} — ${failed} failed.`, {
          description: failures.length
            ? `e.g. ${failures[0].phone}: ${failures[0].reason}`
            : undefined,
        });
      }
      fetchBalance();
    } catch (err: any) {
      console.error("Send failed:", err);
      toast.error("Failed to send broadcast: " + (err.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const recipientCountLabel =
    targetingMode === "specific"
      ? `${selectedUsers.length} selected user${selectedUsers.length === 1 ? "" : "s"}`
      : recipientFilter === "all"
        ? "All users"
        : recipientFilter === "tenants"
          ? "All tenants"
          : "All landlords";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMS Broadcast Center</h1>
        <p className="text-muted-foreground text-sm">Send system announcements to a broad audience or to specific users</p>
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
                {message.length} characters · ~{Math.ceil(message.length / 160)} SMS segment{Math.ceil(message.length / 160) !== 1 ? "s" : ""} per recipient · Target: <span className="font-medium text-foreground">{recipientCountLabel}</span>
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
              <ToggleGroup
                type="single"
                value={targetingMode}
                onValueChange={(v) => v && setTargetingMode(v as "audience" | "specific")}
                className="grid grid-cols-2 gap-1 w-full"
              >
                <ToggleGroupItem value="audience" className="text-xs gap-1">
                  <Users className="h-3.5 w-3.5" /> Audience
                </ToggleGroupItem>
                <ToggleGroupItem value="specific" className="text-xs gap-1">
                  <Search className="h-3.5 w-3.5" /> Specific users
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {targetingMode === "audience" ? (
              <div className="space-y-2">
                <Label className="text-xs">Audience</Label>
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
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Search users</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, phone, email or user ID…"
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searching && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedUsers.map((u) => (
                      <Badge
                        key={u.user_id}
                        variant="secondary"
                        className="text-[11px] gap-1 pr-1"
                      >
                        <span className="truncate max-w-[120px]">{u.full_name || u.phone}</span>
                        <button
                          type="button"
                          onClick={() => removeSelected(u.user_id)}
                          className="hover:text-destructive"
                          aria-label={`Remove ${u.full_name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {searchTerm.trim().length >= 2 && (
                  <div className="border rounded-md max-h-56 overflow-y-auto divide-y bg-card">
                    {searchResults.length === 0 && !searching && (
                      <div className="text-xs text-muted-foreground p-3 text-center">No users found</div>
                    )}
                    {searchResults.map((u) => {
                      const picked = !!selectedUsers.find((s) => s.user_id === u.user_id);
                      return (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => toggleSelectUser(u)}
                          className={`w-full text-left px-2.5 py-2 text-xs hover:bg-accent transition-colors flex items-start justify-between gap-2 ${picked ? "bg-primary/5" : ""}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{u.full_name || "(unnamed)"}</p>
                            <p className="text-muted-foreground truncate">{u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {u.role && <Badge variant="outline" className="text-[9px] px-1 py-0">{u.role}</Badge>}
                            {picked && <Badge variant="default" className="text-[9px] px-1 py-0">Picked</Badge>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {selectedUsers.length}/{MAX_SELECTED} selected
                </p>
              </div>
            )}

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
              disabled={sending || !message.trim() || (targetingMode === "specific" && selectedUsers.length === 0)}
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
              Messages are sent by Center for Financial Literacy, E-Commerce and Digitalization via unique API. Sender ID: "RentControl". Each SMS segment is up to 160 characters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SmsBroadcast;
