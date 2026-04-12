import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import HeroSection from "@/components/marketing/HeroSection";
import AdvisorShowcaseSection from "@/components/marketing/AdvisorShowcaseSection";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import PricingSection from "@/components/marketing/PricingSection";
import ExpertNetworkSection from "@/components/marketing/ExpertNetworkSection";
import SocialProofSection from "@/components/marketing/SocialProofSection";
import FooterSection from "@/components/marketing/FooterSection";

export default async function MarketingPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main>
      <HeroSection />
      <AdvisorShowcaseSection />
      <HowItWorksSection />
      <PricingSection />
      <ExpertNetworkSection />
      <SocialProofSection />
      <FooterSection />
    </main>
  );
}
