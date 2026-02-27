import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, KeyRound, Shield, User, Phone, Mail, MapPin, Briefcase, QrCode, Star } from "lucide-react";
import KycVerificationCard from "@/components/KycVerificationCard";
import UserRatings from "@/components/UserRatings";

const ProfilePage = () => {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [ghanaCardNo, setGhanaCardNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  // Registration info
  const [registrationId, setRegistrationId] = useState("");
  const [registrationFeePaid, setRegistrationFeePaid] = useState(false);
  const [registrationDate, setRegistrationDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setEmail(profile.email || "");
        setOccupation(profile.occupation || "");
        setWorkAddress(profile.work_address || "");
        setGhanaCardNo(profile.ghana_card_no || "");
        setNationality(profile.nationality || "");
        setEmergencyContactName(profile.emergency_contact_name || "");
        setEmergencyContactPhone(profile.emergency_contact_phone || "");
      }

      if (role === "tenant") {
        const { data: tenant } = await supabase.from("tenants").select("*").eq("user_id", user.id).maybeSingle();
        if (tenant) {
          setRegistrationId(tenant.tenant_id);
          setRegistrationFeePaid(tenant.registration_fee_paid);
          setRegistrationDate(tenant.registration_date);
          setExpiryDate(tenant.expiry_date);
        }
      } else if (role === "landlord") {
        const { data: landlord } = await supabase.from("landlords").select("*").eq("user_id", user.id).maybeSingle();
        if (landlord) {
          setRegistrationId(landlord.landlord_id);
          setRegistrationFeePaid(landlord.registration_fee_paid);
          setRegistrationDate(landlord.registration_date);
          setExpiryDate(landlord.expiry_date);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [user, role]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        occupation,
        work_address: workAddress,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
      })
      .eq("user_id", user!.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const baseUrl = window.location.origin;
  const qrData = `${baseUrl}/verify/${role}/${registrationId}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account information and security</p>
      </div>

      {/* ID Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <QRCodeSVG
                value={qrData}
                size={140}
                bgColor="hsl(0, 0%, 100%)"
                fgColor="hsl(152, 55%, 22%)"
                level="H"
                includeMargin
              />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {role === "tenant" ? "Tenant" : "Landlord"} Registration
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <code className="text-lg font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                  {registrationId || "N/A"}
                </code>
                <Badge variant={registrationFeePaid ? "default" : "destructive"} className="text-xs">
                  {registrationFeePaid ? "Active" : "Unpaid"}
                </Badge>
              </div>
              {registrationDate && (
                <p className="text-xs text-muted-foreground">
                  Registered: {new Date(registrationDate).toLocaleDateString()} 
                  {expiryDate && ` • Expires: ${new Date(expiryDate).toLocaleDateString()}`}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
                <QrCode className="h-3.5 w-3.5" /> Scan QR code to verify registration status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC Verification */}
      {role !== "regulator" && <KycVerificationCard />}

      {/* Ratings */}
      {user && role !== "regulator" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Ratings & Reviews</CardTitle>
            <CardDescription>What others say about you</CardDescription>
          </CardHeader>
          <CardContent>
            <UserRatings userId={user.id} />
          </CardContent>
        </Card>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone"><Phone className="inline h-3.5 w-3.5 mr-1" />Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email"><Mail className="inline h-3.5 w-3.5 mr-1" />Email</Label>
              <Input id="email" value={email} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" value={nationality} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghanaCard">Ghana Card No.</Label>
              <Input id="ghanaCard" value={ghanaCardNo} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation"><Briefcase className="inline h-3.5 w-3.5 mr-1" />Occupation</Label>
              <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workAddress"><MapPin className="inline h-3.5 w-3.5 mr-1" />Work Address</Label>
            <Input id="workAddress" value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} />
          </div>

          <Separator />
          <h3 className="text-sm font-semibold text-foreground">Emergency Contact</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyName">Name</Label>
              <Input id="emergencyName" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Phone</Label>
              <Input id="emergencyPhone" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline">
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
