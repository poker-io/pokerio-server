import { databaseInit } from '../databaseConnection'

test('Database connection', async () => {
  await expect(databaseInit()).resolves.not.toThrow()
})
