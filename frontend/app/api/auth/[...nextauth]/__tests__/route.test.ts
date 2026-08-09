// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const GET_HANDLER = vi.fn();
const POST_HANDLER = vi.fn();
vi.mock("@/auth", () => ({ handlers: { GET: GET_HANDLER, POST: POST_HANDLER } }));

describe("/api/auth/[...nextauth]", () => {
  it("re-exports the configured NextAuth GET/POST handlers", async () => {
    const { GET, POST } = await import("../route");
    expect(GET).toBe(GET_HANDLER);
    expect(POST).toBe(POST_HANDLER);
  });
});
