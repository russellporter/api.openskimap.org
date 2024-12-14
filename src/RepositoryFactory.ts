import * as arangojs from "arangojs";
import * as Config from "./Config";
import { Repository } from "./Repository";

export default async function getRepository(): Promise<Repository> {
  const client = new arangojs.Database(Config.arangodb.url);

  try {
    await client.createDatabase(Config.arangodb.database);
  } catch (_) {}


  client.database(Config.arangodb.database);

  await client.createAnalyzer('en_edge_ngram_v2', {
    type: 'text',
    properties: {
      locale: 'en',
      accent: false,
      case: 'lower',
      stemming: false,
      edgeNgram: {
        min: 3,
        max: 20,
        preserveOriginal: true
      }
    }
  })

  const featuresCollection = client.collection(
    Config.arangodb.featuresCollection
  );
  try {
    await featuresCollection.create();
  } catch (_) {}
  await featuresCollection.ensureIndex({type: "persistent", fields: ["type"]})
  await featuresCollection.ensureIndex({type: "geo", fields: ["geometry"], geoJson: true})
  await featuresCollection.ensureIndex({
    type: 'inverted',
    name: 'textSearch_v2',
    fields: [{name: 'searchableText[*]', analyzer: 'en_edge_ngram_v2'}, {name: 'type'}]
  })

  const view = await client.view('textSearch');
  const viewExists = await view.exists();
  if (!viewExists) {
    await client.createView(
      'textSearch',
      {type: "search-alias", indexes: [{collection: featuresCollection.name, index: 'textSearch'}]}
    );
  }

  return new Repository(client);
}
