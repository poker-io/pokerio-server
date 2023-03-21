import express from 'express'
import admin from 'firebase-admin'

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
})

const app = express()
export const port = 42069

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})

app.listen(port, () => {
  console.log(`[server]: Server is running at localhost:${port}`)
})
