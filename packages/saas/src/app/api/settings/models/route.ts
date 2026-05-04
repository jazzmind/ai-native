import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getAppSetting, setAppSetting } from "@/lib/db";

export const runtime = "nodejs";

export const MODEL_ROLES = ["agent", "fast", "research", "chat"] as const;
export type ModelRole = typeof MODEL_ROLES[number];

export interface ModelRoleConfig {
  agent: string;   // general agent tasks, briefings
  fast: string;    // quick responses, routing
  research: string; // deep research, opus-class
  chat: string;    // interactive conversation
}

export const DEFAULT_MODEL_ROLES: ModelRoleConfig = {
  agent: "claude-sonnet-4-5",
  fast: "claude-haiku-4-5",
  research: "claude-opus-4-5",
  chat: "claude-sonnet-4-5",
};

const SETTINGS_KEY = "model_roles";

export async function GET() {
  try {
    const { org } = await getRequiredUserAndOrg();
    const saved = await getAppSetting<ModelRoleConfig>(org.id, SETTINGS_KEY);
    const config: ModelRoleConfig = { ...DEFAULT_MODEL_ROLES, ...saved };
    return Response.json({ config });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { org } = await getRequiredUserAndOrg();
    const body = await req.json();

    // Validate: only accept known role keys
    const updates: Partial<ModelRoleConfig> = {};
    for (const role of MODEL_ROLES) {
      if (typeof body[role] === "string" && body[role].trim()) {
        updates[role] = body[role].trim();
      }
    }

    const existing = (await getAppSetting<ModelRoleConfig>(org.id, SETTINGS_KEY)) ?? DEFAULT_MODEL_ROLES;
    const next: ModelRoleConfig = { ...existing, ...updates };
    await setAppSetting(org.id, SETTINGS_KEY, next);

    return Response.json({ ok: true, config: next });
  } catch (err) {
    return handleAuthError(err);
  }
}
