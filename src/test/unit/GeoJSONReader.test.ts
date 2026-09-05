import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readGeoJSONFeatures } from "../../GeoJSONReader.ts";

const directories: string[] = [];

async function fixture(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "geojson-reader-"));
  directories.push(directory);
  const file = join(directory, "features.geojson");
  await writeFile(file, contents);
  return file;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("readGeoJSONFeatures", () => {
  it("streams FeatureCollection entries in order", async () => {
    const features = [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [1, 2] },
        properties: { type: "spot", id: "first" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [3, 4] },
        properties: { type: "spot", id: "second" },
      },
    ];
    const file = await fixture(
      JSON.stringify({ type: "FeatureCollection", features }),
    );

    const actual = [];
    for await (const feature of readGeoJSONFeatures(file)) {
      actual.push(feature);
    }

    expect(actual).toEqual(features);
  });

  it("rejects malformed JSON", async () => {
    const file = await fixture('{"type":"FeatureCollection","features":[');

    await expect(async () => {
      for await (const _ of readGeoJSONFeatures(file)) {
        // Consume the stream so parser errors are surfaced.
      }
    }).rejects.toThrow();
  });
});
