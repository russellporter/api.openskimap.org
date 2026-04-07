import express from "express"
import * as path from "path"
import * as config from "./Config"
import { async } from "./Middleware"
import { Repository } from "./Repository"

const entityTypeToSourceType: Record<string, string> = {
  openskimap: "openskimap",
  skimap_org: "skimap.org",
  openstreetmap: "openstreetmap",
};

export function createApp(repository: Repository) {
  const app = express()

  app.use(function (_, res, next) {
    res.header("Access-Control-Allow-Methods", "GET")
    res.header("Access-Control-Allow-Origin", "*")
    next()
  })

  app.get("/health", (_, res) => {
    res.json({ status: "ok" })
  })

  app.get("/index.html", async (req, res) => {
    if (req.query.obj && typeof req.query.obj === "string") {
      try {
        const objType = typeof req.query.obj_type === "string" ? req.query.obj_type : "openskimap";
        const sourceType = entityTypeToSourceType[objType];
        let objectExists: boolean;
        if (sourceType && sourceType !== "openskimap") {
          try {
            await repository.getBySourceId(sourceType, req.query.obj);
            objectExists = true;
          } catch {
            objectExists = false;
          }
        } else {
          objectExists = await repository.has(req.query.obj);
        }
        if (!objectExists) {
          res.status(404)
        }
      } catch (error) {
        console.log(`Failed to verify object`)
        console.log(error)
      }
    }

    const frontendPath = config.frontend.path
    if (!frontendPath) {
      console.log("Missing frontend path, cannot handle index.html responses")
      res.sendStatus(500)
      return
    }

    res.sendFile(path.join(frontendPath, "index.html"))
  })

  app.get(
    "/search",
    async(async (req, res) => {
      let text = req.query.query
      if (typeof text !== "string") {
        res.status(400).json({ error: 'Invalid query' })
        return
      }

      text = text.trim()
      if (text.length === 0) {
        res.send([])
        return
      }

      const results: GeoJSON.Feature[] = await repository.search(text, 10)

      res.send(results)
    })
  )

  app.get(
    "/features/:id.geojson",
    async(async (req, res) => {
      try {
        const feature = await repository.get(req.params.id as string)
        res.send(feature)
      } catch (error) {
        res.sendStatus(404)
      }
    })
  )

  app.get(
    "/features/:entityType/:id.geojson",
    async(async (req, res) => {
      const entityType = req.params.entityType as string;
      const id = req.params.id as string;
      const sourceType = entityTypeToSourceType[entityType];
      if (!sourceType) {
        res.status(400).json({ error: `Unknown entity type: ${entityType}` });
        return;
      }
      try {
        const feature =
          sourceType === "openskimap"
            ? await repository.get(id)
            : await repository.getBySourceId(sourceType, id);
        res.send(feature);
      } catch (error) {
        res.sendStatus(404);
      }
    })
  )

  return app
}
