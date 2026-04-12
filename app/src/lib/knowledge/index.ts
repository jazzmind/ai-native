import type { KnowledgeProvider } from "./knowledge-provider";
import { BusiboxKnowledgeProvider } from "./busibox-provider";
import { StandaloneKnowledgeProvider } from "./standalone-provider";
import { listTargets } from "@/lib/config-store";

let _provider: KnowledgeProvider | null = null;

export function getKnowledgeProvider(): KnowledgeProvider {
  if (_provider) return _provider;

  const targets = listTargets();
  const busiboxTarget = targets.find(t => t.type === "busibox" && t.status === "deployed");

  if (busiboxTarget && busiboxTarget.config.hostUrl && busiboxTarget.config.apiKey) {
    _provider = new BusiboxKnowledgeProvider(busiboxTarget.config.hostUrl, busiboxTarget.config.apiKey);
  } else {
    _provider = new StandaloneKnowledgeProvider();
  }

  return _provider;
}

export function resetKnowledgeProvider(): void {
  _provider = null;
}

export type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "./knowledge-provider";
export { knowledgeToolPrompt } from "./knowledge-provider";
