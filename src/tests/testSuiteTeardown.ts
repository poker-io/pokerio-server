import { databaseShutdown } from '../utils/databaseConnection'

afterAll(async () => {
  await databaseShutdown()
}, 20000)
