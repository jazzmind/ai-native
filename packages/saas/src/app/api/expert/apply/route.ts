import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { createExpertProfile, getExpertProfileByUserId } from "@/lib/db";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const existing = await getExpertProfileByUserId(user.id);
  if (existing) {
    return Response.json({ error: "You already have an expert profile" }, { status: 409 });
  }

  const body = await req.json();
  const { displayName, bio, domains, rateMinCents, rateMaxCents } = body;

  if (!displayName || !domains || !rateMinCents || !rateMaxCents) {
    return Response.json(
      { error: "displayName, domains, rateMinCents, and rateMaxCents are required" },
      { status: 400 }
    );
  }

  if (bio && bio.length < 200) {
    return Response.json({ error: "Bio must be at least 200 characters" }, { status: 400 });
  }

  if (rateMaxCents < rateMinCents) {
    return Response.json({ error: "rateMaxCents must be >= rateMinCents" }, { status: 400 });
  }

  const profile = await createExpertProfile({
    userId: user.id,
    email: user.email,
    displayName,
    bio,
    domains: Array.isArray(domains) ? domains.join(',') : domains,
    rateMinCents,
    rateMaxCents,
  });

  return Response.json({ profile, message: "Application submitted! We'll review and reach out within 48 hours." });
}
