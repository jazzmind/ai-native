import { NextRequest } from "next/server";
import { processExpiredBids } from "@/lib/marketplace-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processExpiredBids();
    return Response.json({ ok: true, processed: true });
  } catch (err) {
    console.error("Cron process-bids error:", err);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
