import { app, port } from './app.js'

app.listen(port, () => {
  console.log(`[server]: Server is running at localhost:${port}`)
})
