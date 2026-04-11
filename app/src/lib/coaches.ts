export type CoachIconName =
  | "Target"
  | "Compass"
  | "Cpu"
  | "Coins"
  | "BarChart3"
  | "Scale"
  | "TrendingUp"
  | "Link";

export interface CoachConfig {
  key: string;
  name: string;
  agentId: string;
  description: string;
  icon: CoachIconName;
  keywords: string[];
}

export interface CoachMeta {
  key: string;
  name: string;
  description: string;
  icon: CoachIconName;
  keywords: string[];
}

export const COACH_META: CoachMeta[] = [
  {
    key: "founder",
    name: "Founder Coach",
    description: "Personal goals, vision, accountability",
    icon: "Target",
    keywords: ["goal", "vision", "focus", "personal", "motivation", "founder", "mission", "purpose", "lifestyle", "burnout", "balance"],
  },
  {
    key: "strategy",
    name: "Strategy Coach",
    description: "Market positioning, KPIs, competitive analysis",
    icon: "Compass",
    keywords: ["strategy", "market", "competitive", "positioning", "okr", "kpi", "planning", "roadmap", "competitor", "moat", "differentiation"],
  },
  {
    key: "technology",
    name: "Technology Coach",
    description: "Architecture, AI/ML, DevOps, security",
    icon: "Cpu",
    keywords: ["tech", "architecture", "infrastructure", "api", "database", "cloud", "ai", "ml", "devops", "security", "code", "framework", "stack", "deploy"],
  },
  {
    key: "funding",
    name: "Funding Coach",
    description: "VC, angel, bootstrapping, cap table",
    icon: "Coins",
    keywords: ["funding", "raise", "investor", "vc", "angel", "bootstrap", "cap table", "dilution", "valuation", "safe", "term sheet", "equity"],
  },
  {
    key: "finance",
    name: "Finance Coach",
    description: "Accounting, tax, FP&A, risk, compliance",
    icon: "BarChart3",
    keywords: ["finance", "accounting", "tax", "budget", "cash flow", "burn rate", "revenue", "expense", "compliance", "audit", "bookkeeping", "payroll"],
  },
  {
    key: "legal",
    name: "Legal Coach",
    description: "Corporate structure, contracts, IP",
    icon: "Scale",
    keywords: ["legal", "contract", "ip", "patent", "trademark", "incorporation", "entity", "agreement", "liability", "nda", "employment", "gdpr"],
  },
  {
    key: "growth",
    name: "Growth Coach",
    description: "GTM, sales, marketing, retention",
    icon: "TrendingUp",
    keywords: ["growth", "marketing", "sales", "gtm", "acquisition", "retention", "churn", "conversion", "funnel", "pricing", "launch", "customer", "brand"],
  },
];

export function getCoachMeta(key: string): CoachMeta | undefined {
  return COACH_META.find((c) => c.key === key);
}
