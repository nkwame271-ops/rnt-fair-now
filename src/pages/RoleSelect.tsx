import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Lock, Shield, Scale, Phone, Mail, MapPin, Code2, Database, FileJson, Send, Search } from "lucide-react";
import { GHANA_REGIONS_OFFICES } from "@/hooks/useAdminProfile";
import LiveChatWidget from "@/components/LiveChatWidget";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";
import rcdLogo from "@/assets/rcd-logo.png";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";
import cfledLogo from "@/assets/cfled-logo.png";

const ContactForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("contact_submissions" as any).insert({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      message: message.trim(),
    } as any);
    if (error) {
      toast.error("Failed to send message. Please try again.");
    } else {
      toast.success("Message sent! We'll get back to you soon.");
      setName(""); setEmail(""); setPhone(""); setMessage("");
    }
    setSending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Name *</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Your full name" required maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Email *</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="your@email.com" required maxLength={255}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Phone</label>
        <input
          value={phone} onChange={(e) => setPhone(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="+233 XXX XXX XXX" maxLength={20}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Message *</label>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="How can we help you?" required maxLength={1000}
        />
      </div>
      <button
        type="submit" disabled={sending}
        className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send className="h-4 w-4" />
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
};

const RoleSelect = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (loading) return;
    if (user && role) {
      if (role === "tenant") navigate("/tenant/dashboard", { replace: true });
      else if (role === "landlord") navigate("/landlord/dashboard", { replace: true });
      else if (role === "regulator") navigate("/regulator/dashboard", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const roles = [
    {
      title: "Tenant",
      description: "Find housing, file complaints, manage agreements, and know your rights under Act 220.",
      icon: Users,
      path: "/login?role=tenant",
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Landlord",
      description: "Register properties, manage tenancies, handle agreements, and stay compliant.",
      icon: Building2,
      path: "/login?role=landlord",
      color: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />

          <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-24 sm:pt-12 sm:pb-32">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-16">
              <div className="flex items-center gap-3">
                <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 w-auto" />
                <div>
                  <h2 className="text-white font-bold text-sm sm:text-base leading-tight">
                    Republic of Ghana
                  </h2>
                  <p className="text-white/70 text-xs">Ministry of Works & Housing</p>
                </div>
              </div>
              <img src={rcdLogo} alt="RCD Logo" className="h-10 w-auto rounded-lg" />
            </div>

            {/* Hero content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
                Rent Control
                <span className="block text-amber-400">Department</span>
              </h1>
              <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto">
                Digital platform for fair, transparent, and regulated rental housing in Ghana — powered by Act 220.
              </p>
            </motion.div>
          </div>
        </div>

        {/* About Us Section */}
        <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">About Us</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              The Rent Control Department was established under the Rent Act, 1963 (Act 220) to regulate 
              rents, prevent unlawful ejection, and ensure fair housing practices across Ghana.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Tenant Protection",
                text: "We enforce maximum advance rent of 6 months, proper eviction procedures, and habitable living conditions as mandated by law.",
              },
              {
                icon: Scale,
                title: "Fair Regulation",
                text: "We mediate disputes between landlords and tenants, assess fair rent values, and ensure compliance with housing standards.",
              },
              {
                icon: Building2,
                title: "Property Registration",
                text: "All rental properties and tenancy agreements must be registered with the department to ensure legal protection for all parties.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="bg-card border border-border rounded-xl p-6 text-center"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* API Services Section */}
        <section className="bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
                <Code2 className="h-3.5 w-3.5" /> API SERVICES
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Open Data for Government Agencies</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
                We provide secure, scoped API access to verified rental housing data for authorized government agencies. Each agency receives a unique API key limited to only the data they are authorized to access.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {[
                { agency: "Ghana Revenue Authority (GRA)", data: "Landlord rental income summaries, 8% rent tax collected per period, landlord tax profiles", icon: FileJson, scopes: ["tax:read"] },
                { agency: "National Identification Authority (NIA)", data: "Ghana Card KYC verification statistics, identity cross-referencing counts", icon: Shield, scopes: ["identity:read"] },
                { agency: "Ghana Statistical Service (GSS)", data: "Tenant/landlord counts by region, citizen vs non-citizen breakdown, property type distribution", icon: Database, scopes: ["stats:read", "tenants:read"] },
                { agency: "Metropolitan & District Assemblies", data: "Properties by area, vacancy rates, complaint counts for local planning and zoning", icon: Building2, scopes: ["properties:read", "complaints:read"] },
                { agency: "Ministry of Works & Housing", data: "National property inventory, housing conditions, regional distribution data", icon: Building2, scopes: ["properties:read", "stats:read"] },
                { agency: "Ghana Police Service", data: "Housing complaint records and tenant/landlord dispute data on request", icon: Shield, scopes: ["complaints:read"] },
              ].map((item, i) => (
                <motion.div
                  key={item.agency}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{item.agency}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs mb-3">{item.data}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.scopes.map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 max-w-2xl mx-auto">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" /> API Request Example
              </h3>
              <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1 text-muted-foreground">
                <p className="text-foreground">POST /functions/v1/agency-api</p>
                <p>Header: X-API-Key: rcd_xxxxxxxxxx...</p>
                <p className="text-foreground mt-2">{"{"}</p>
                <p>&nbsp; "endpoint": "stats/overview",</p>
                <p>&nbsp; "filters": {"{"} "region": "Greater Accra" {"}"}</p>
                <p className="text-foreground">{"}"}</p>
              </div>
              <p className="text-muted-foreground text-xs mt-3">
                Contact the Rent Control Department to request API access for your agency.
              </p>
            </div>
          </div>
        </section>

        {/* Role Selection */}
        <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Get Started</h2>
            <p className="text-muted-foreground text-sm">Select your role to continue</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {roles.map((role, i) => (
              <motion.button
                key={role.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(role.path)}
                className="group bg-card border border-border rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4`}>
                  <role.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{role.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{role.description}</p>
                <span className="text-primary text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Continue <ArrowRight className="h-4 w-4" />
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Office Locator Section */}
        <OfficeLocator />

        {/* Contact Form Section */}
        <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Contact Us</h2>
            <p className="text-muted-foreground text-sm">Have a question or need assistance? Send us a message.</p>
          </motion.div>
          <ContactForm />
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 mt-8">
          <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <img src={coatOfArms} alt="" className="h-8 w-auto" />
                  <span className="font-bold text-foreground text-sm">Rent Control Department</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Ministry of Works & Housing, Republic of Ghana. Regulating rental housing since 1963.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Contact</h4>
                <div className="space-y-2 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> +233 303 960 792</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3 w-3" /> Accra, Greater Accra Region</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Legal</h4>
                <div className="space-y-2 text-muted-foreground text-xs">
                  <p>Rent Act, 1963 (Act 220)</p>
                  <p>Rent (Amendment) Decree, 1973</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex flex-col items-center gap-2 mb-4">
                <img src={cfledLogo} alt="CFLED" className="h-8 w-auto opacity-70" />
                <span className="text-muted-foreground/60 text-[10px] text-center">Designed by Center for Financial Literacy, E-Commerce and Digitalization</span>
                <div className="text-muted-foreground/50 text-[10px] text-center space-y-0.5">
                  <p>Ghana Hostels Ltd., University of Ghana, Legon</p>
                  <p>Contact: 0508376903 · Email: info@cflec.org</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-muted-foreground/50 text-[11px]">© {new Date().getFullYear()} Rent Control Department</p>
                <button
                  onClick={() => navigate("/regulator/login")}
                  className="text-muted-foreground/40 hover:text-muted-foreground text-[11px] transition-colors"
                >
                  Staff Portal
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <LiveChatWidget />
    </>
  );
};

export default RoleSelect;
