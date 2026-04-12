import { NextRequest } from "next/server";
import { countEligibleExperts } from "@/lib/db";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  const budgetCents = parseInt(req.nextUrl.searchParams.get("budgetCents") || "0");

  if (!domain || !budgetCents) {
    return Response.json({ count: 0 });
  }

  const count = await countEligibleExperts(domain, budgetCents);
  return Response.json({ count });
}
