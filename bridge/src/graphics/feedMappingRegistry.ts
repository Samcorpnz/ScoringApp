import { FeedMapping } from "./feedTransform";
import championDataNetball from "./feedMappings/championdata.netball.json";

const MAPPINGS: FeedMapping[] = [championDataNetball as FeedMapping];

export function findFeedMapping(provider: string, sport: string): FeedMapping | undefined {
  return MAPPINGS.find(m => m.provider === provider && m.sport === sport);
}
