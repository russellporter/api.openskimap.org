import { createApp } from "./app.ts"
import getRepository from "./RepositoryFactory.ts"

const port = 3000

;(async () => {
  const repository = await getRepository()
  const app = createApp(repository)

  app.listen(port, () => console.log(`Listening on ${port}`))
})()
