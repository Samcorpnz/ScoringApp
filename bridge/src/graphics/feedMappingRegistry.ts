import { FeedMapping } from "./feedTransform";
import championDataNetball from "./feedMappings/championdata.netball.json";
import championDataBasketball from "./feedMappings/championdata.basketball.json";
import championDataCricket from "./feedMappings/championdata.cricket.json";

// championdata.basketball.json and championdata.cricket.json are best-guess
// field mappings built without a real sample payload (unlike netball, which
// was built from an actual Champion Data response) — field paths follow the
// same naming conventions Champion Data uses elsewhere, but stats will show
// blank until verified against a live feed and corrected. That correction is
// a JSON edit here, not a bridge redeploy — this is the whole point of the
// mapping-file approach (docs/graphics-operator-addon-plan.md).
const MAPPINGS: FeedMapping[] = [
  championDataNetball as FeedMapping,
  championDataBasketball as FeedMapping,
  championDataCricket as FeedMapping,
];

export function findFeedMapping(provider: string, sport: string): FeedMapping | undefined {
  return MAPPINGS.find(m => m.provider === provider && m.sport === sport);
}
