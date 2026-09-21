import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Shield, Scale, Phone, MapPin, Code2, Send, Search } from "lucide-react";
import { GHANA_REGIONS_OFFICES } from "@/hooks/useAdminProfile";
import LiveChatWidget from "@/components/LiveChatWidget";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBg from "@/assets/hero-bg.jpg";
import cfledLogo from "@/assets/cfled-logo.png";
import Seo from "@/components/Seo";

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
      // Notify admin team (best-effort; do not block UX)
      supabase.functions.invoke("send-notification", {
        body: {
          event: "contact_received",
          email: "info@rentcontrolghana.com",
          data: {
            name: name.trim(),
            from_email: email.trim(),
            phone: phone.trim() || "",
            message: message.trim(),
          },
        },
      }).catch(() => {});
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

const OfficeLocator = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredResults = searchTerm.trim()
    ? GHANA_REGIONS_OFFICES
        .map(r => ({
          region: r.region,
          offices: r.offices.filter(o =>
            o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.region.toLowerCase().includes(searchTerm.toLowerCase())
          ),
        }))
        .filter(r => r.offices.length > 0)
    : [];

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Find Your Nearest Office</h2>
        <p className="text-muted-foreground text-sm">Search by location, area, or region to find a Rent Control office near you.</p>
      </motion.div>

      <div className="max-w-lg mx-auto mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search offices (e.g. Kumasi, Greater Accra, Tema...)"
            className="flex h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {searchTerm.trim() && filteredResults.length === 0 && (
        <p className="text-center text-muted-foreground text-sm">No offices found matching "{searchTerm}"</p>
      )}

      {filteredResults.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-4">
          {filteredResults.map(r => (
            <div key={r.region} className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> {r.region} Region
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {r.offices.map(o => (
                  <div key={o.id} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    <Building2 className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                    {o.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searchTerm.trim() && (
        <div className="max-w-2xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GHANA_REGIONS_OFFICES.map(r => (
            <button
              key={r.region}
              onClick={() => setSearchTerm(r.region)}
              className="bg-card border border-border rounded-lg p-3 text-left hover:bg-muted/30 transition-colors"
            >
              <p className="font-medium text-foreground text-sm">{r.region}</p>
              <p className="text-xs text-muted-foreground">{r.offices.length} office(s)</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const RoleSelect = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (loading) return;
    if (!user || !role) return;
    if (role === "regulator") { navigate("/regulator/dashboard", { replace: true }); return; }
    if (role === "nugs_admin") { navigate("/nugs/dashboard", { replace: true }); return; }
    if (role === "landlord") { navigate("/landlord/dashboard", { replace: true }); return; }
    if (role === "agent") { navigate("/agent/dashboard", { replace: true }); return; }
    if (role === "tenant") {
      // Branch student vs regular tenant
      supabase.from("tenants").select("is_student").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if ((data as any)?.is_student) navigate("/nugs/dashboard", { replace: true });
        else navigate("/tenant/dashboard", { replace: true });
      });
      return;
    }
    // Agent role may not be surfaced through user_roles yet — check agent_staff
    (async () => {
      const { data: agentRow } = await (supabase as any)
        .from("agent_staff")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (agentRow && (agentRow.status === "active" || agentRow.status === "approved")) {
        navigate("/agent/dashboard", { replace: true });
      }
    })();
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
      <Seo
        title="Rent Control Ghana — Rental Housing Services"
        description="Register tenancies, file complaints, manage properties, and access rental housing services in Ghana."
        canonicalPath="/"
      />
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
              <div className="flex items-center gap-3 text-white">
                <Shield className="h-9 w-9" />
                <h2 className="font-bold text-sm sm:text-base leading-tight">Rent Control Ghana</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/developers")}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1.5 transition-colors"
                >
                  <Code2 className="h-3.5 w-3.5" /> Developer Portal
                </button>
              </div>
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
                 <span className="block text-amber-400">Ghana</span>
              </h1>
              <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto">
                Digital platform for fair, transparent, and regulated rental housing in Ghana — powered by Act 220.
              </p>
            </motion.div>
          </div>
        </div>

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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
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
               Rent Control Ghana helps tenants and landlords manage agreements, payments, complaints,
               and fair housing responsibilities in one place.
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
                 text: "Rental properties and tenancy agreements can be registered on the platform to keep records clear and accessible to both parties.",
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
               <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Secure Data Services for Partners</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
                 Accredited partners can request secure, scoped access to verified rental housing data. Each partner receives a unique API key limited to approved data.
              </p>
            </motion.div>

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
                Create a developer account to get an instant sandbox key. Live (production) access is granted after admin approval.
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate("/developers/signup")}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                <Code2 className="h-4 w-4" /> Request API Access
              </button>
              <button
                onClick={() => navigate("/developers/docs/quickstart")}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors"
              >
                <FileJson className="h-4 w-4" /> Read the Documentation
              </button>
              <button
                onClick={() => navigate("/developers/login")}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-foreground font-medium text-sm hover:bg-muted transition-colors"
              >
                Developer Login <ArrowRight className="h-4 w-4" />
              </button>
            </div>
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
                  <Shield className="h-7 w-7 text-primary" />
                  <span className="font-bold text-foreground text-sm">Rent Control Ghana</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Digital tools and support for tenants, landlords, and rental housing partners.
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
                <h4 className="font-semibold text-foreground text-sm mb-3">Get involved</h4>
                <div className="space-y-2 text-muted-foreground text-xs">
                  <button onClick={() => navigate("/premium-service")} className="block hover:text-foreground transition-colors font-medium">Premium Service</button>
                  <button onClick={() => navigate("/developers")} className="block hover:text-foreground transition-colors">Developer Portal</button>
                  <button onClick={() => navigate("/developers/docs/quickstart")} className="block hover:text-foreground transition-colors">API Documentation</button>
                  <button onClick={() => navigate("/developers/signup")} className="block hover:text-foreground transition-colors">Request API Access</button>
                  <p className="pt-2">Rent Act, 1963 (Act 220)</p>
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
                <p className="text-muted-foreground/50 text-[11px]">© {new Date().getFullYear()} Rent Control Ghana</p>
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
