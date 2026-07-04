import { FeedMapping } from "./feedTransform";
import championDataNetball from "./feedMappings/championdata.netball.json";
import championDataBasketball from "./feedMappings/championdata.basketball.json";
import championDataCricket from "./feedMappings/championdata.cricket.json";
import mockPushNetball from "./feedMappings/mockpush.netball.json";

// championdata.basketball.json and championdata.cricket.json are best-guess
// field mappings built without a real sample payload (unlike netball, which
// was built from an actual Champion Data response) — field paths follow the
// same naming conventions Champion Data uses elsewhere, but stats will show
// blank until verified against a live feed and corrected. That correction is
// a JSON edit here, not a bridge redeploy — this is the whole point of the
// mapping-file approach (docs/graphics-operator-addon-plan.md).
//
// mockpush.netball.json is a synthetic second provider (Phase D) proving the
// registry keys on provider+sport, not just sport — it deliberately uses a
// differently-shaped payload (nested match.teams/roster/stats) from
// Champion Data's flat fields, and is paired with a push-based bridge source
// (bridge/src/sources/mockPushSource.ts) instead of HTTP polling.
const MAPPINGS: FeedMapping[] = [
  championDataNetball as FeedMapping,
  championDataBasketball as FeedMapping,
  championDataCricket as FeedMapping,
  mockPushNetball as FeedMapping,
];

export function findFeedMapping(provider: string, sport: string): FeedMapping | undefined {
  return MAPPINGS.find(m => m.provider === provider && m.sport === sport);
}
