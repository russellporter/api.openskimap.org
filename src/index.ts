import express from "express";
import { FeatureType } from "openskidata-format";
import { async } from "./Middleware";
import getRepository from "./RepositoryFactory";

const app = express();
const port = 3000;

(async () => {
  const repository = await getRepository();

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

  app.listen(port, () => console.log(`Listening on ${port}`));
})();
