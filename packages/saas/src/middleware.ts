import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);
export default auth;
export { auth as middleware };

export const config = {
  matcher: [
    "/((?!api/auth|api/review-access|api/billing/webhook|api/marketplace/expert-count|api/cron|review/|login|signup|expert/apply|_next/static|_next/image|favicon.ico).*)",
  ],
};
