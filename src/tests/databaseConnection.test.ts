import { databaseInit } from '../utils/databaseConnection'

test('Database connection', async () => {
  await expect(databaseInit()).resolves.not.toThrow()
})
