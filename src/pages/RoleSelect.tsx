import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Lock } from "lucide-react";
import LiveChatWidget from "@/components/LiveChatWidget";
import heroBg from "@/assets/hero-bg.jpg";
import rcdLogo from "@/assets/rcd-logo.png";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

const RoleSelect = () => {
  const navigate = useNavigate();

  return (
    <>
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
...
      </div>
    </div>
    <LiveChatWidget />
    </>);

};

export default RoleSelect;