import {
  acquireTickLockWith,
  EvalCapable,
  publishStateUpdateWith,
  subscribeStateUpdatesWith,
  parseStateSyncMessage,
  PublishCapable,
  SubscribeCapable,
} from "../redis";

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

// A minimal fake pub/sub pair: publishing on one directly invokes the other's
// registered "message" listener, mirroring how two separate relay instances
// would see each other's writes via a real Redis channel — without needing
// an actual Redis connection in tests.
class FakePubSub implements PublishCapable, SubscribeCapable {
  private listener: ((channel: string, message: string) => void) | null = null;

  subscribe(_channel: string): void {}

  on(_event: "message", listener: (channel: string, message: string) => void): void {
    this.listener = listener;
  }

  publish(channel: string, message: string): void {
    this.listener?.(channel, message);
  }
}

describe("state sync pub/sub", () => {
  it("delivers a published state update to the subscriber", () => {
    const bus = new FakePubSub();
    const received: Array<{ orgId: string; state: unknown }> = [];
    subscribeStateUpdatesWith(bus, (orgId, state) => received.push({ orgId, state }));

    publishStateUpdateWith(bus, "org-1", { sequenceId: 5, home: { score: 3 } });

    expect(received).toEqual([{ orgId: "org-1", state: { sequenceId: 5, home: { score: 3 } } }]);
  });

  it("ignores messages on unrelated channels", () => {
    const bus = new FakePubSub();
    const received: unknown[] = [];
    subscribeStateUpdatesWith(bus, (orgId, state) => received.push({ orgId, state }));

    // Simulate a message arriving on some other channel the same client
    // happens to be subscribed to.
    bus.publish("some-other-channel", JSON.stringify({ orgId: "org-1", state: {} }));

    expect(received).toEqual([]);
  });

  it("drops malformed messages instead of throwing", () => {
    const bus = new FakePubSub();
    const received: unknown[] = [];
    subscribeStateUpdatesWith(bus, (orgId, state) => received.push({ orgId, state }));

    expect(() => bus.publish("matchstate-sync", "not json")).not.toThrow();
    expect(received).toEqual([]);
  });
});

describe("parseStateSyncMessage", () => {
  it("parses a well-formed message", () => {
    expect(parseStateSyncMessage(JSON.stringify({ orgId: "org-1", state: { sequenceId: 1 } }))).toEqual({
      orgId: "org-1",
      state: { sequenceId: 1 },
    });
  });

  it("rejects messages missing orgId", () => {
    expect(parseStateSyncMessage(JSON.stringify({ state: {} }))).toBeNull();
  });

  it("rejects non-JSON input", () => {
    expect(parseStateSyncMessage("{not json")).toBeNull();
  });
});
