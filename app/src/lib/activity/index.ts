import type { ActivityProvider } from "./activity-provider";
import { StandaloneActivityProvider } from "./standalone-activity-provider";
import { BusiboxActivityProvider } from "./busibox-activity-provider";
import { listTargets } from "@/lib/config-store";

let _provider: ActivityProvider | null = null;

export function getActivityProvider(): ActivityProvider {
  if (_provider) return _provider;

  const targets = listTargets();
  const busiboxTarget = targets.find(t => t.type === "busibox" && t.status === "deployed");

  if (busiboxTarget && busiboxTarget.config.hostUrl && busiboxTarget.config.apiKey) {
    _provider = new BusiboxActivityProvider(busiboxTarget.config.hostUrl, busiboxTarget.config.apiKey);
  } else {
    _provider = new StandaloneActivityProvider();
  }

  return _provider;
}

export function resetActivityProvider(): void {
  _provider = null;
}

export type { ActivityProvider, ActivityEntry } from "./activity-provider";
