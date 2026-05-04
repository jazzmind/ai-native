import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/logout
 *
 * Clears app-specific session cookies only.
 */
export async function POST(request: NextRequest) {
  const appName = process.env.APP_NAME || "ai-native";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";

  const response = NextResponse.json({ success: true });

  response.cookies.set(`${appName}-session`, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: basePath,
  });

  response.cookies.set("auth_token", "", { maxAge: 0, path: basePath });

  return response;
}
