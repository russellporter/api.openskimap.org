import * as arangojs from "arangojs";
import * as Config from "../Config";

(async () => {
  try {
    const client = new arangojs.Database(Config.arangodb.url);
    await client.dropDatabase(Config.arangodb.database);
  } catch (e) {
    console.error("Failed dropping database", e);
    process.exit(1);
  }
})();
