export const arangodb = {
  url: process.env.ARANGODB_URL || "http://localhost:8529",
  database: process.env.ARANGODB_DATABASE || "openskimap",
  featuresCollection: "features"
};
