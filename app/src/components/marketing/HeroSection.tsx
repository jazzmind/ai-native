import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="py-20 sm:py-28 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
          Your AI advisory board —{" "}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            always in session
          </span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Seven specialized advisors across strategy, finance, legal, growth, and technology.
          Human expert review when stakes are high.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3 text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
          >
            Start free — no credit card
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-3 text-base font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-center"
          >
            See it in action
          </a>
        </div>
      </div>
    </section>
  );
}
