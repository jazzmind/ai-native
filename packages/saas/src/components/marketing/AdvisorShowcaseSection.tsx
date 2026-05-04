import { Target, Compass, Cpu, Coins, BarChart3, Scale, TrendingUp } from "lucide-react";

const ADVISORS = [
  {
    name: "Founder Advisor",
    icon: Target,
    domain: "Vision & Leadership",
    topics: ["Personal mission alignment", "Founder burnout prevention", "Goal setting & accountability"],
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    name: "Strategy Advisor",
    icon: Compass,
    domain: "Market & Competition",
    topics: ["Market positioning", "Competitive analysis", "OKR & KPI planning"],
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    name: "Technology Advisor",
    icon: Cpu,
    domain: "Engineering & Architecture",
    topics: ["Tech stack decisions", "AI/ML strategy", "Security & DevOps"],
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    name: "Funding Advisor",
    icon: Coins,
    domain: "Investment & Capital",
    topics: ["Fundraising strategy", "Cap table management", "Investor relations"],
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    name: "Finance Advisor",
    icon: BarChart3,
    domain: "Accounting & FP&A",
    topics: ["Cash flow management", "Tax planning", "Financial modeling"],
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    name: "Legal Advisor",
    icon: Scale,
    domain: "Corporate & Compliance",
    topics: ["Entity structuring", "Contracts & IP", "Employment law"],
    color: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-900/20",
  },
  {
    name: "Growth Advisor",
    icon: TrendingUp,
    domain: "GTM & Sales",
    topics: ["Go-to-market strategy", "Pricing models", "Customer acquisition"],
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
];

export default function AdvisorShowcaseSection() {
  return (
    <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
          Your complete advisory team
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto">
          Each advisor is a specialist trained in their domain, ready to tackle your toughest questions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ADVISORS.map((advisor) => (
            <div
              key={advisor.name}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition"
            >
              <div className={`w-10 h-10 rounded-lg ${advisor.bg} flex items-center justify-center mb-3`}>
                <advisor.icon className={`w-5 h-5 ${advisor.color}`} />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{advisor.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{advisor.domain}</p>
              <ul className="space-y-1">
                {advisor.topics.map((topic) => (
                  <li key={topic} className="text-sm text-gray-600 dark:text-gray-300">
                    &bull; {topic}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
