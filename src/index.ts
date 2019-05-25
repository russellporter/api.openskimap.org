import * as express from "express"

const app = express()
const port = 3000

app.get('/search', (req, res) => {
    res.send()
})

app.listen(port, () => console.log(`Listening on ${port}`))
