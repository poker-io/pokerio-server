import { app } from '../app'
import request from 'supertest'

test('Status test', (done) => {
  request(app).get('/status').expect(200).end(done)
})
