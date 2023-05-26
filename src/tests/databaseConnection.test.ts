import { databaseInit } from '../utils/databaseConnection'
import './testSuiteTeardown'

test('Database connection', async () => {
  await expect(databaseInit()).resolves.not.toThrow()
})
