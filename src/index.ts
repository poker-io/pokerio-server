import express from 'express'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('./src/serviceAccount.json', 'utf-8'))

admin.initializeApp({
  credential: admin.credential.cert({
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    projectId: serviceAccount.project_id,
  }),
})

const app = express()
export const port = 42069

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})

app.listen(port, () => {
  console.log(`[server]: Server is running at localhost:${port}`)
})
