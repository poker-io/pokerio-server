import { app, port } from './app.js'
import { databaseInit } from './databaseConnection'

databaseInit()
  .then(() => {
    // Only start listening if database connection was successful
    app.listen(port, () => {
      console.log(`[server]: Server is running at localhost:${port}`)
    })
  })
  .catch(() => {
    // Don't start the server in case of an error
    console.log('Failed to init database')
    process.exit(1)
  })
