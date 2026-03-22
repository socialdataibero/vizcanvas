import { describe, expect, it } from "vitest";
import { resolveUploadedTableName } from "@/db/fileLoader";

describe("resolveUploadedTableName", () => {
  it("reuses sample_data instead of generating suffixed duplicates", () => {
    expect(resolveUploadedTableName("sample_data", ["sample_data"])).toBe("sample_data");
    expect(resolveUploadedTableName("sample_data", ["sample_data", "sample_data_1"])).toBe("sample_data");
  });

  it("generates suffixed names for other uploaded tables", () => {
    expect(resolveUploadedTableName("orders", ["orders", "orders_1"])).toBe("orders_2");
  });
});
