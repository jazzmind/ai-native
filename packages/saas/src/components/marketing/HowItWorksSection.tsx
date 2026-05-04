import { MessageSquare, Users, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    step: 1,
    icon: MessageSquare,
    title: "Ask anything",
    description:
      "Describe your challenge in plain language. Our AI router automatically selects the best advisors for your question.",
  },
  {
    step: 2,
    icon: Users,
    title: "Your AI board convenes",
    description:
      "Multiple specialized advisors analyze your question from different angles, then synthesize a unified recommendation.",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Get expert review when needed",
    description:
      "For high-stakes decisions, request a review from a vetted human expert. Delivered within 4 hours, or your money back.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
          How it works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ step, icon: Icon, title, description }) => (
            <div key={step} className="text-center">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-sm font-medium text-blue-600 mb-2">Step {step}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
