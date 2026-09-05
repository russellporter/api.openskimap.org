import { createReadStream } from "node:fs";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";

import type { Feature } from "./types.ts";

export function readGeoJSONFeatures(path: string): AsyncIterable<Feature> {
  return chain([
    createReadStream(path, { encoding: "utf8" }),
    parser(),
    pick({ filter: "features" }),
    streamArray(),
    (entry: { key: number; value: unknown }) => entry.value as Feature,
  ]);
}
