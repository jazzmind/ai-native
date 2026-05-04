import { NextRequest } from "next/server";
import { handleWebhookEvent } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  try {
    const body = await req.text();
    await handleWebhookEvent(body, signature);
    return Response.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return Response.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 400 }
    );
  }
}
