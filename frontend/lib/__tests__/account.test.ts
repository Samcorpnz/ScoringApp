// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: { org: { findUnique: (...a: unknown[]) => findUniqueMock(...a) } },
}));

import { getAccountForOrg } from "../account";

describe("getAccountForOrg", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("returns the account when the org has one", async () => {
    const account = { id: "acc_1", name: "Wellington Netball" };
    findUniqueMock.mockResolvedValue({ account });
    const result = await getAccountForOrg("org-1");
    expect(result).toBe(account);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { account: true },
    });
  });

  it("returns null when the org exists but has no linked account", async () => {
    findUniqueMock.mockResolvedValue({ account: null });
    const result = await getAccountForOrg("org-1");
    expect(result).toBeNull();
  });

  it("returns null when the org doesn't exist at all", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await getAccountForOrg("missing-org");
    expect(result).toBeNull();
  });
});
