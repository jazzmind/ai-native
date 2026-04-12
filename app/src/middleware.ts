export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/review-access|api/billing/webhook|api/marketplace/expert-count|api/cron|review/|login|signup|expert/apply|_next/static|_next/image|favicon.ico).*)",
  ],
};
