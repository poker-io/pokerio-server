import { app } from '../app'
import request from 'supertest'
import { databaseInit } from '../databaseConnection'

test('Simple test', (done) => {
  request(app)
    .get('/test')
    .expect(200)
    .expect('Content-Type', 'text/html; charset=utf-8')
    .expect('Hello from typescript express!')
    .end(done)
})

test('Database connection', async () => {
  await expect(databaseInit()).resolves.not.toThrow()
})
