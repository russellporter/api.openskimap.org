import express from "express"
import * as path from "node:path"

import * as config from "./Config.ts"
import { boundsAreaSqKm } from "./geometry.ts"
import type { Repository } from "./Repository.ts"
import type { Feature } from "./types.ts"

const entityTypeToSourceType: Record<string, string> = {
  openskimap: "openskimap",
  skimap_org: "skimap.org",
  openstreetmap: "openstreetmap",
};

const MAX_BBOX_AREA_SQ_KM = 1000

// Canonical feature type values, as stored in the database.
const featureTypes = ["run", "lift", "skiArea", "spot"] as const
const featureTypeLookup = new Map<string, string>(
  featureTypes.map((type) => [type.toLowerCase(), type])
)

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
    async (req, res) => {
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

      const results: Feature[] = await repository.search(text, 10)

      res.send(results)
    }
  )

  app.get(
    "/features.geojson",
    async (req, res) => {
      const bbox = parseBbox(req.query.bbox)
      if (!bbox.ok) {
        res.status(400).json({ error: bbox.error })
        return
      }

      const types = parseTypes(req.query.types)
      if (!types.ok) {
        res.status(400).json({ error: types.error })
        return
      }

      const features = await repository.getInBounds(
        bbox.value.minLon,
        bbox.value.minLat,
        bbox.value.maxLon,
        bbox.value.maxLat,
        types.value
      )

      res.type("application/geo+json").send({
        type: "FeatureCollection",
        features,
      })
    }
  )

  app.get(
    "/features/:id.geojson",
    async (req, res) => {
      try {
        const feature = await repository.get(req.params.id as string)
        res.send(feature)
      } catch (error) {
        res.sendStatus(404)
      }
    }
  )

  app.get(
    "/features/:entityType/:id.geojson",
    async (req, res) => {
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
    }
  )

  return app
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function parseBbox(raw: unknown): ParseResult<{
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {
      ok: false,
      error: "Missing required bbox parameter (minLon,minLat,maxLon,maxLat)",
    }
  }

  const parts = raw.split(",").map((part) => part.trim())
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
    return {
      ok: false,
      error: "bbox must be 4 comma-separated numbers: minLon,minLat,maxLon,maxLat",
    }
  }

  const values = parts.map((part) => Number(part))
  if (values.some((value) => !Number.isFinite(value))) {
    return { ok: false, error: "bbox values must be valid numbers" }
  }

  const [minLon, minLat, maxLon, maxLat] = values
  if (minLon < -180 || maxLon > 180) {
    return { ok: false, error: "bbox longitudes must be between -180 and 180" }
  }
  if (minLat < -90 || maxLat > 90) {
    return { ok: false, error: "bbox latitudes must be between -90 and 90" }
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return {
      ok: false,
      error:
        "bbox must satisfy minLon < maxLon and minLat < maxLat (boxes crossing the antimeridian are unsupported)",
    }
  }

  const areaSqKm = boundsAreaSqKm({ minLon, minLat, maxLon, maxLat })
  if (areaSqKm > MAX_BBOX_AREA_SQ_KM) {
    return {
      ok: false,
      error: `bbox area of ${Math.round(areaSqKm)} sq km exceeds the ${MAX_BBOX_AREA_SQ_KM} sq km limit`,
    }
  }

  return { ok: true, value: { minLon, minLat, maxLon, maxLat } }
}

function parseTypes(raw: unknown): ParseResult<string[] | undefined> {
  if (raw === undefined) {
    return { ok: true, value: undefined }
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "types must be a comma-separated list of feature types" }
  }

  const requested = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (requested.length === 0) {
    return { ok: false, error: "types must contain at least one feature type" }
  }

  const resolved: string[] = []
  for (const type of requested) {
    const canonical = featureTypeLookup.get(type.toLowerCase())
    if (!canonical) {
      return {
        ok: false,
        error: `Unknown feature type: ${type} (expected one of ${featureTypes.join(", ")})`,
      }
    }
    resolved.push(canonical)
  }

  return { ok: true, value: resolved }
}
