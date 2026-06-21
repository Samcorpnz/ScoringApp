import { prisma } from "@scoringapp/db";
import { MatchState, DEFAULT_MATCH_STATE } from "./types";

const SAVE_DEBOUNCE_MS = 2000;

export interface MatchStore {
  orgId: string;
  load(): Promise<MatchState>;
  save(state: MatchState): void;
  flush(): Promise<void>;
}

const stores = new Map<string, MatchStore>();

// One store per org, lazily created and cached so debounce timers persist
// across calls. Each org's active (LIVE) match is found-or-created on first
// access — this is what makes match state genuinely tenant-scoped rather
// than a single relay-wide singleton.
export function getMatchStore(orgId: string): MatchStore | null {
  if (!process.env.DATABASE_URL) return null;

  const existing = stores.get(orgId);
  if (existing) return existing;

  let matchId: string | null = null;
  let pending: MatchState | null = null;
  let timer: NodeJS.Timeout | null = null;

  async function resolveMatchId(): Promise<string> {
    if (matchId) return matchId;
    const live = await prisma.match.findFirst({ where: { orgId, status: "LIVE" }, orderBy: { createdAt: "desc" } });
    if (live) {
      matchId = live.id;
      return matchId;
    }
    const created = await prisma.match.create({ data: { orgId, state: DEFAULT_MATCH_STATE as object } });
    matchId = created.id;
    return matchId;
  }

  async function writeThrough(state: MatchState): Promise<void> {
    const id = await resolveMatchId();
    await prisma.match.update({ where: { id }, data: { state: state as object } });
  }

  const store: MatchStore = {
    orgId,

    async load() {
      const id = await resolveMatchId();
      const row = await prisma.match.findUnique({ where: { id } });
      return (row?.state as unknown as MatchState) ?? { ...DEFAULT_MATCH_STATE };
    },

    save(state: MatchState) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const toWrite = pending;
        pending = null;
        if (toWrite) writeThrough(toWrite).catch(err => console.error(`[relay] failed to persist match state for org ${orgId}`, err));
      }, SAVE_DEBOUNCE_MS);
    },

    async flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      const toWrite = pending;
      pending = null;
      if (toWrite) await writeThrough(toWrite);
    },
  };

  stores.set(orgId, store);
  return store;
}

export function allActiveStores(): MatchStore[] {
  return [...stores.values()];
}
