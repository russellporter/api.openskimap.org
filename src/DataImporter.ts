import { Repository } from "./Repository";

class DataImporter {
  private repository: Repository;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  import = () => {};

  purgeOldData() {
    // TODO: Implement
  }
}
