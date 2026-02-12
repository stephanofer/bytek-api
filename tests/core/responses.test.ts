import { describe, it, expect } from "vitest";

import { buildPaginationMeta } from "@core/responses";

describe("buildPaginationMeta", () => {
  it("calculates totalPages correctly", () => {
    const meta = buildPaginationMeta(50, 1, 10);

    expect(meta).toEqual({
      total: 50,
      page: 1,
      pageSize: 10,
      totalPages: 5,
    });
  });

  it("rounds up totalPages when items don't divide evenly", () => {
    const meta = buildPaginationMeta(51, 1, 10);

    expect(meta.totalPages).toBe(6);
  });

  it("returns totalPages = 1 when total <= pageSize", () => {
    const meta = buildPaginationMeta(5, 1, 10);

    expect(meta.totalPages).toBe(1);
  });

  it("returns totalPages = 0 when total is 0", () => {
    const meta = buildPaginationMeta(0, 1, 10);

    expect(meta.totalPages).toBe(0);
  });

  it("preserves the page and pageSize values passed in", () => {
    const meta = buildPaginationMeta(100, 3, 25);

    expect(meta.page).toBe(3);
    expect(meta.pageSize).toBe(25);
    expect(meta.totalPages).toBe(4);
  });
});
