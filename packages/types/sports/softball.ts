export type SoftballFormat = "fastpitch" | "slowpitch";

export interface SoftballState {
  sport: "softball";
  format: SoftballFormat;
  inningHalf: "top" | "bottom";
  outs: number;
  balls: number;
  strikes: number;
}
