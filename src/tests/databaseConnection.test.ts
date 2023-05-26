import { databaseInit } from '../utils/databaseConnection'
import './afterAll'

test('Database connection', async () => {
  await expect(databaseInit()).resolves.not.toThrow()
})
