import {
  databaseShutdown,
  runRequestWithClient,
} from '../utils/databaseConnection'

afterAll(async () => {
  await runRequestWithClient(undefined, async (client) => {
    try {
      await client.query('DELETE FROM games')
      await client.query('DELETE FROM players')
    } catch (err) {
      console.log('clearing query failed')
      console.log(err.stack)
    }
  })
  await databaseShutdown()
}, 20000)
