import type {
  LiftFeature,
  RunFeature,
  SkiAreaFeature,
  SkiPass,
  SpotFeature
} from "openskidata-format";

/**
 * A ski pass, shaped as a feature so that it can be stored and searched alongside the geographic
 * features. It is a commercial product rather than a place, so it has no geometry.
 */
export type SkiPassFeature = {
  type: "Feature";
  geometry: null;
  properties: SkiPass;
};

export type Feature =
  | RunFeature
  | LiftFeature
  | SkiAreaFeature
  | SpotFeature
  | SkiPassFeature;

export function isSkiPassFeature(feature: Feature): feature is SkiPassFeature {
  return feature.properties.type === "skiPass";
}
