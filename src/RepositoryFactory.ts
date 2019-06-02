import * as arangojs from "arangojs";
import * as Config from "./Config";
import { Repository } from "./Repository";

export default async function getRepository(): Promise<Repository> {
  const client = new arangojs.Database(Config.arangodb.url);

  try {
    await client.createDatabase(Config.arangodb.database);
  } catch (_) {}

  client.useDatabase(Config.arangodb.database);

  const featuresCollection = client.collection(
    Config.arangodb.featuresCollection
  );
  try {
    await featuresCollection.create();
  } catch (_) {}
  await featuresCollection.createSkipList("type");
  await featuresCollection.createGeoIndex("geometry", { geoJson: true });
  await featuresCollection.createFulltextIndex("searchableText", 2);

  return new Repository(client);
}
