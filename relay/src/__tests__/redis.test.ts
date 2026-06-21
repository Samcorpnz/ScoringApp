import { acquireTickLockWith, EvalCapable } from "../redis";

// A minimal fake standing in for ioredis's eval(), implementing just enough
// GET/SET-with-TTL semantics for the Lua script under test — no real Redis
// connection needed.
class FakeRedis implements EvalCapable {
  private value: string | null = null;
  private expiresAt = 0;

  async eval(script: string, _numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    const [, ownerId, ttlMs] = args as [string, string, number];
    const now = Date.now();
    const current = now < this.expiresAt ? this.value : null;
    if (current === null || current === ownerId) {
      this.value = ownerId;
      this.expiresAt = now + Number(ttlMs);
      return 1;
    }
    return 0;
  }

  expire(): void {
    this.expiresAt = 0;
  }
}

describe("acquireTickLockWith", () => {
  it("grants the lock when free", async () => {
    const fake = new FakeRedis();
    await expect(acquireTickLockWith(fake, "org-1", "instance-a")).resolves.toBe(true);
  });

  it("lets the same owner renew its own lock", async () => {
    const fake = new FakeRedis();
    await acquireTickLockWith(fake, "org-1", "instance-a");
    await expect(acquireTickLockWith(fake, "org-1", "instance-a")).resolves.toBe(true);
  });

  it("denies the lock to a different instance while held", async () => {
    const fake = new FakeRedis();
    await acquireTickLockWith(fake, "org-1", "instance-a");
    await expect(acquireTickLockWith(fake, "org-1", "instance-b")).resolves.toBe(false);
  });

  it("lets a new instance reclaim the lock after expiry", async () => {
    const fake = new FakeRedis();
    await acquireTickLockWith(fake, "org-1", "instance-a", 10);
    fake.expire();
    await expect(acquireTickLockWith(fake, "org-1", "instance-b")).resolves.toBe(true);
  });
});
