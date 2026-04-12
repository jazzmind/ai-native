export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/review-access|review/|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
