import express from "express";
import { FeatureType } from "openskidata-format";
import * as path from "path";
import * as config from "./Config";
import { async } from "./Middleware";
import getRepository from "./RepositoryFactory";

const app = express();
const port = 3000;

(async () => {
  const repository = await getRepository();

  app.get("/index.html", async (req, res) => {
    if (req.query.obj && typeof req.query.obj === "string") {
      try {
        const objectExists = await repository.has(req.query.obj);
        if (!objectExists) {
          res.status(404);
        }
      } catch (error) {
        console.log(`Failed to verify object`);
        console.log(error);
      }
    }

    const frontendPath = config.frontend.path;
    if (!frontendPath) {
      console.log("Missing frontend path, cannot handle index.html responses");
      res.sendStatus(500);
      return;
    }

    res.sendFile(path.join(frontendPath, "index.html"));
  });

  app.get("/*", function (_, res, next) {
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Origin", "*");
    next();
  });

  app.get(
    "/search",
    async(async (req, res) => {
      const text: string = req.query.query;
      const sanitizedText = text
        .split(new RegExp("[\\s,\\*\\-\\+\\|\\:\\.]+"))
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
        .map((c) => "prefix:" + c)
        .join(",");

      let limit = 5;

      const skiAreas: GeoJSON.Feature[] = await repository.search(
        sanitizedText,
        FeatureType.SkiArea,
        limit
      );

      let lifts: GeoJSON.Feature[] = [];
      let runs: GeoJSON.Feature[] = [];

      limit -= skiAreas.length;
      if (limit > 0) {
        lifts = await repository.search(sanitizedText, FeatureType.Lift, limit);
      }

      limit -= lifts.length;
      if (limit > 0) {
        runs = await repository.search(sanitizedText, FeatureType.Run, limit);
      }

      res.send(skiAreas.concat(lifts, runs));
    })
  );

  app.get(
    "/features/:id.geojson",
    async(async (req, res) => {
      const feature = await repository.get(req.params.id);

      if (feature === null) {
        res.sendStatus(404);
      } else {
        res.send(feature);
      }
    })
  );

  app.listen(port, () => console.log(`Listening on ${port}`));
})();
