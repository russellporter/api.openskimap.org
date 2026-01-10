import { createApp } from "./app"
import getRepository from "./RepositoryFactory"

const port = 3000

;(async () => {
  const repository = await getRepository()
  const app = createApp(repository)

  app.listen(port, () => console.log(`Listening on ${port}`))
})()
