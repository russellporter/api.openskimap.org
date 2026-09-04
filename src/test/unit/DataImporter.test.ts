import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataImporter } from "../../DataImporter";
import { Repository } from "../../Repository";

describe("DataImporter.importSkiPasses", () => {
  let directory: string;
  let repository: Pick<Repository, "upsert">;
  let importer: DataImporter;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "ski-pass-import-"));
    repository = { upsert: vi.fn().mockResolvedValue(undefined) };
    importer = new DataImporter(repository as Repository);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function fixture(contents: unknown): Promise<string> {
    const file = join(directory, "ski_passes.json");
    await writeFile(file, JSON.stringify(contents));
    return file;
  }

  it("rejects the old array-shaped output", async () => {
    await expect(
      importer.importSkiPasses(await fixture([]), "import-1"),
    ).rejects.toThrow("to hold a ski pass catalog");
  });

  it("imports only actual passes from a catalog", async () => {
    const brand = {
      type: "skiPassBrand",
      id: "ikon",
      name: "Ikon Pass",
      sources: [],
    };
    const pass = {
      type: "skiPass",
      id: "ikon-standard",
      name: "Ikon",
      brandID: "ikon",
      brandName: "Ikon Pass",
      sources: [],
      skiAreaCount: 110,
      skiAreaIDs: [],
      unresolvedRosterEntries: [],
    };

    await importer.importSkiPasses(
      await fixture({ brands: [brand], passes: [pass] }),
      "import-1",
    );

    expect(repository.upsert).toHaveBeenCalledOnce();
    expect(repository.upsert).toHaveBeenCalledWith(
      {
        type: "Feature",
        geometry: null,
        properties: pass,
      },
      "import-1",
    );
  });

  it("rejects a brand in the catalog's passes array", async () => {
    await expect(
      importer.importSkiPasses(
        await fixture({
          brands: [],
          passes: [
            {
              type: "skiPassBrand",
              id: "ikon",
              name: "Ikon Pass",
              sources: [],
            },
          ],
        }),
        "import-1",
      ),
    ).rejects.toThrow('to hold only ski passes, found "skiPassBrand"');
  });
});
