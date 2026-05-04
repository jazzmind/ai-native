import { PostgresActivityProvider } from "./postgres-activity-provider";

export type { ActivityProvider, ActivityEntry } from "./activity-provider";

// SaaS always uses Postgres/Neon — no Busibox-target detection needed.
const _provider = new PostgresActivityProvider();

export function getActivityProvider() {
  return _provider;
}

export function resetActivityProvider(): void {
  // No-op — singleton Postgres provider needs no reset.
}
