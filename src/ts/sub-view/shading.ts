// Per-row heat shading for the census matrix.
//
// Why ratio buckets and not a linear value->opacity ramp:
// raw value would just light up whichever profession has big numbers, which
// the label already tells you. Per-row ratio (cell / row max) answers the
// scanning question instead -- "within this material, where is my stock?"

const BUCKET_COUNT = 5;

// Bucket 0 is reserved for "has a value but barely registers".
// Returns 0..BUCKET_COUNT-1, or -1 for an empty cell (caller leaves it blank).
export function shadeBucket(value: number, rowMax: number): number {
  if (value <= 0 || rowMax <= 0) return -1;
  const ratio = value / rowMax;
  // ceil so anything above zero lands in bucket >= 1; the top ratio (1.0)
  // lands in the last bucket. clamp guards float fuzz at the boundary.
  const bucket = Math.ceil(ratio * (BUCKET_COUNT - 1));
  return Math.min(BUCKET_COUNT - 1, Math.max(0, bucket));
}

// Highest value across a row's tiers. Zero if the row is empty.
export function rowMax(tiers: number[]): number {
  let max = 0;
  for (const t of tiers) {
    if (t > max) max = t;
  }
  return max;
}
