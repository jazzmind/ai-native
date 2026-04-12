import type { ProfileProvider } from "./profile-provider";
import { StandaloneProfileProvider } from "./standalone-profile-provider";
import { BusiboxProfileProvider } from "./busibox-profile-provider";
import { listTargets } from "@/lib/config-store";

let _provider: ProfileProvider | null = null;

export function getProfileProvider(): ProfileProvider {
  if (_provider) return _provider;

  const targets = listTargets();
  const busiboxTarget = targets.find(t => t.type === "busibox" && t.status === "deployed");

  if (busiboxTarget && busiboxTarget.config.hostUrl && busiboxTarget.config.apiKey) {
    _provider = new BusiboxProfileProvider(busiboxTarget.config.hostUrl, busiboxTarget.config.apiKey);
  } else {
    _provider = new StandaloneProfileProvider();
  }

  return _provider;
}

export function resetProfileProvider(): void {
  _provider = null;
}

export type { ProfileProvider, ProfileEntry } from "./profile-provider";
export { formatProfileForPrompt } from "./profile-provider";
