import { NextRequest, NextResponse } from "next/server";
import { createSSOGetHandler, createSSOPostHandler } from "@jazzmind/busibox-app/lib/authz";

const verbose = process.env.VERBOSE_AUTH_LOGGING === 'true';

const handleGet = createSSOGetHandler(NextResponse, {
  verbose,
  defaultAppName: 'ai-native',
});

const handlePost = createSSOPostHandler(NextResponse, {
  verbose,
  defaultAppName: 'ai-native',
});

export async function GET(request: NextRequest) {
  return handleGet(request);
}

export async function POST(request: NextRequest) {
  return handlePost(request);
}
