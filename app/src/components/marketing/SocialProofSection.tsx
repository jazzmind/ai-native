const VALUE_PROPS = [
  {
    heading: "7 specialized advisors",
    description:
      "Strategy, finance, legal, technology, growth, funding, and founder coaching — all available 24/7, no scheduling required.",
  },
  {
    heading: "On-demand expert review",
    description:
      "When the stakes are high, get a human expert to review your AI-generated advice. Reviews start at $25 and are delivered in ~4 hours.",
  },
  {
    heading: "Built for founders",
    description:
      "Multi-advisor synthesis gives you the breadth of a full advisory board. BYO your own API key to get started for free.",
  },
];

export default function SocialProofSection() {
  return (
    <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
          Why founders choose AIdvisory
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto">
          We&apos;re building this in public. Early adopters get free access while we refine the experience.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {VALUE_PROPS.map((v, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                {v.heading}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
