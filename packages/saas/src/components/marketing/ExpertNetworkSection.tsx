import Link from "next/link";
import { ShieldCheck, Clock, DollarSign } from "lucide-react";

export default function ExpertNetworkSection() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            When you need more than AI
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Our expert marketplace connects you with vetted professionals who review
            AI-generated advice and provide actionable human insight.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Affordable reviews</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Reviews start at just $25. We match you with the best expert for your domain and budget.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Get matched</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              We notify top experts in your domain. They bid on your request with estimated timelines.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Delivered in 4 hours</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get a structured review within 4 hours, or your money is refunded automatically.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/expert/apply"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Are you an expert? Join our network &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
