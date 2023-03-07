import express from "express"

const app = express()
const port = 42069

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})

app.listen(port, () => {
  console.log(`[server]: Server is running at localhost:${port}`)
})