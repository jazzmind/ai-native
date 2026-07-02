import { PostgresProfileProvider } from "./postgres-profile-provider";

export type { ProfileProvider, ProfileEntry } from "@ai-native/core";
export { formatProfileForPrompt } from "@ai-native/core";

// SaaS always uses Postgres/Neon — no Busibox-target detection needed.
const _provider = new PostgresProfileProvider();

export function getProfileProvider() {
  return _provider;
}

export function resetProfileProvider(): void {
  // No-op — singleton Postgres provider needs no reset.
}
