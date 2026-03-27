import { motion } from "framer-motion";
import {
  FileText, Search, ShieldCheck, MessageSquare, CreditCard, Home,
  ClipboardList, Users, BookOpen, Scale, Building2, Receipt
} from "lucide-react";
import tenantPreview from "@/assets/tenant-dashboard-preview.jpg";
import landlordPreview from "@/assets/landlord-dashboard-preview.jpg";

const tenantFeatures = [
  { icon: Search, title: "Browse Marketplace", desc: "Find verified, rent-controlled properties across Ghana with fair pricing." },
  { icon: FileText, title: "Digital Agreements", desc: "Sign tenancy agreements online with legal backing under Act 220." },
  { icon: ShieldCheck, title: "File Complaints", desc: "Report unlawful rent increases, ejections, or unsafe conditions directly." },
  { icon: Scale, title: "Rent Checker", desc: "Verify if your rent is within the approved benchmark for your area." },
  { icon: CreditCard, title: "Secure Payments", desc: "Pay rent through escrow — your money is protected until conditions are met." },
  { icon: MessageSquare, title: "Legal Assistant", desc: "AI-powered guidance on your rights under the Rent Act, 1963." },
];

const landlordFeatures = [
  { icon: Building2, title: "Register Properties", desc: "Register and manage all your rental properties in one place." },
  { icon: Users, title: "Manage Tenants", desc: "Add tenants, create agreements, and track occupancy digitally." },
  { icon: Receipt, title: "Rent Cards", desc: "Issue official rent cards to tenants as proof of regulated tenancy." },
  { icon: ClipboardList, title: "Applications", desc: "Receive and review rental applications from the marketplace." },
  { icon: BookOpen, title: "Agreements", desc: "Generate Act 220-compliant tenancy agreements with digital signatures." },
  { icon: Home, title: "Payment Settings", desc: "Set up mobile money or bank account to receive rent payments." },
];

const FeatureBlock = ({
  title,
  subtitle,
  features,
  image,
  reverse,
}: {
  title: string;
  subtitle: string;
  features: typeof tenantFeatures;
  image: string;
  reverse?: boolean;
}) => (
  <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? "lg:direction-rtl" : ""}`}>
    {/* Text side */}
    <motion.div
      initial={{ opacity: 0, x: reverse ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={reverse ? "lg:order-2" : ""}
    >
      <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{subtitle}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="flex gap-3"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <f.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm">{f.title}</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>

    {/* Image side */}
    <motion.div
      initial={{ opacity: 0, x: reverse ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className={reverse ? "lg:order-1" : ""}
    >
      <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/50 border-b border-border">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <img
          src={image}
          alt={`${title} preview`}
          loading="lazy"
          width={1280}
          height={800}
          className="w-full h-auto"
        />
      </div>
    </motion.div>
  </div>
);

const FeatureShowcase = () => {
  return (
    <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
          <ShieldCheck className="h-3.5 w-3.5" /> PLATFORM FEATURES
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Everything You Need, In One Place
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          Whether you're a tenant seeking fair housing or a landlord managing properties,
          our platform provides the tools to make renting transparent, secure, and compliant with Ghanaian law.
        </p>
      </motion.div>

      <div className="space-y-20">
        <FeatureBlock
          title="For Tenants"
          subtitle="Know your rights. Find fair housing. Stay protected."
          features={tenantFeatures}
          image={tenantPreview}
        />
        <FeatureBlock
          title="For Landlords"
          subtitle="Register, manage, and stay compliant — all digitally."
          features={landlordFeatures}
          image={landlordPreview}
          reverse
        />
      </div>
    </section>
  );
};

export default FeatureShowcase;
