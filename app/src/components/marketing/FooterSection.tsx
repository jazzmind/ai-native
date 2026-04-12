import Link from "next/link";

export default function FooterSection() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
          <Link href="#pricing" className="hover:text-gray-700 dark:hover:text-gray-300">
            Pricing
          </Link>
          <Link href="/expert/apply" className="hover:text-gray-700 dark:hover:text-gray-300">
            Join as Expert
          </Link>
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300">
            Terms of Service
          </a>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Quorum. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
