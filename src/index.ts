import express from "express";
import { FeatureType } from "openskidata-format";
import { async } from "./Middleware";
import getRepository from "./RepositoryFactory";

const app = express();
const port = 3000;

(async () => {
  const repository = await getRepository();

  app.get("/*", function(_, res, next) {
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
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .map(c => "prefix:" + c)
        .join(",");

      const skiAreas = await repository.search(
        sanitizedText,
        FeatureType.SkiArea,
        5
      );

      res.send(skiAreas);
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
