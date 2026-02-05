import {
  LiftFeature,
  RunFeature,
  SkiAreaFeature,
  SpotFeature
} from "openskidata-format";

export type Feature = RunFeature | LiftFeature | SkiAreaFeature | SpotFeature;
