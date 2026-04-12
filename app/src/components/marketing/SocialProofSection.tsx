// TODO: Replace with real testimonials after first 10 customers

const TESTIMONIALS = [
  {
    quote: "Quorum replaced three different tools and a monthly advisor retainer. The AI board gives me real answers, not generic advice.",
    name: "Coming soon",
    title: "Founder",
    company: "Stealth startup",
  },
  {
    quote: "The expert review feature is incredible. I got a $25 review from a tax attorney that saved me $12,000.",
    name: "Coming soon",
    title: "CEO",
    company: "Early-stage SaaS",
  },
  {
    quote: "Having seven specialized advisors available 24/7 is like having a board of directors on demand. Game changer for solo founders.",
    name: "Coming soon",
    title: "Solo Founder",
    company: "Pre-revenue startup",
  },
];

export default function SocialProofSection() {
  return (
    <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
          Trusted by founders
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <p className="text-gray-600 dark:text-gray-300 text-sm italic mb-4">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.title}, {t.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
