import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import getRepository from "../../RepositoryFactory.ts";
import { createApp } from "../../app.ts";

describe("Ski passes", () => {
  let app: any;

  beforeAll(async () => {
    const repository = await getRepository();
    app = createApp(repository);
  });

  describe("GET /search", () => {
    it("returns the ski pass itself, not the ski areas on it", async () => {
      const response = await request(app)
        .get("/search?query=Ikon")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body[0].properties).toHaveProperty("type", "skiPass");
      expect(response.body[0].properties).toHaveProperty("name", "Ikon");
    });

    it("ranks a ski pass above ski areas", async () => {
      const response = await request(app).get("/search?query=Epic").expect(200);

      expect(response.body[0].properties).toHaveProperty("type", "skiPass");
      expect(response.body[0].properties).toHaveProperty("name", "Epic Local");
    });

    it("ranks the larger pass first when several match", async () => {
      const response = await request(app).get("/search?query=Ikon").expect(200);

      const passNames = response.body
        .filter((feature: any) => feature.properties.type === "skiPass")
        .map((feature: any) => feature.properties.name);
      expect(passNames).toEqual(["Ikon", "Ikon Base", "Ikon Pass Midwest"]);
    });

    it("returns a ski pass with a null geometry", async () => {
      const response = await request(app).get("/search?query=Ikon").expect(200);

      expect(response.body[0]).toHaveProperty("type", "Feature");
      expect(response.body[0].geometry).toBeNull();
    });

    it("returns each product as an independent pass with its brand reference", async () => {
      const response = await request(app)
        .get("/search?query=Ikon Base")
        .expect(200);

      const pass = response.body.find(
        (feature: any) => feature.properties.id === "ikon-base",
      );
      expect(pass.properties).toMatchObject({
        type: "skiPass",
        brandID: "ikon",
        brandName: "Ikon Pass",
      });
      expect(pass.properties).not.toHaveProperty("tiers");
    });

    it("does not import brands as searchable features", async () => {
      const response = await request(app)
        .get("/search?query=Ikon Pass")
        .expect(200);

      expect(
        response.body.some(
          (feature: any) => feature.properties.type === "skiPassBrand",
        ),
      ).toBe(false);
    });

    it("still finds ski areas by name", async () => {
      const response = await request(app)
        .get("/search?query=Garmisch")
        .expect(200);

      expect(response.body[0].properties).toHaveProperty("type", "skiArea");
    });
  });

  describe("GET /features/:id.geojson", () => {
    it("serves a ski pass by its stable id", async () => {
      const response = await request(app)
        .get("/features/epic-local.geojson")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body.properties).toHaveProperty("type", "skiPass");
      expect(response.body.properties).toHaveProperty("name", "Epic Local");
      expect(response.body.geometry).toBeNull();
    });
  });
});
