import express from 'express'

export const app = express()
export const port = 42069

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})
