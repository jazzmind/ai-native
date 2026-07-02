import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() is required because vi.mock() factories are hoisted above
// top-level const declarations.
const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock("@jazzmind/busibox-app/platform/busibox", () => ({
  BusiboxSearchAdapter: vi.fn().mockImplementation(function BusiboxSearchAdapterMock() {
    return { search: searchMock };
  }),
}));

import { BusiboxKnowledgeProvider } from "../knowledge";

describe("BusiboxKnowledgeProvider.search", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("delegates to BusiboxSearchAdapter.search and maps results onto core SearchResult", async () => {
    searchMock.mockResolvedValue([
      { id: "doc-1", collection: "finance-docs", content: "Q1 revenue grew 30%.", score: 0.92, metadata: { title: "Q1 Report" } },
    ]);

    const provider = new BusiboxKnowledgeProvider(async () => "token-123");
    const results = await provider.search({ userId: "u1", projectId: "p1" }, "revenue", { limit: 3, collection: "finance-docs" });

    expect(searchMock).toHaveBeenCalledWith({
      query: "revenue",
      collections: ["finance-docs"],
      limit: 3,
    });
    expect(results).toEqual([
      { id: "doc-1", content: "Q1 revenue grew 30%.", source: "finance-docs", score: 0.92, metadata: { title: "Q1 Report" } },
    ]);
  });

  it("returns an empty array when the search adapter throws", async () => {
    searchMock.mockRejectedValue(new Error("search-api unavailable"));

    const provider = new BusiboxKnowledgeProvider(async () => "token-123");
    const results = await provider.search({ userId: "u1" }, "anything");

    expect(results).toEqual([]);
  });
});
