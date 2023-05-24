import { runRequestWithClient } from '../utils/databaseConnection'

export default async function teardown() {
  await runRequestWithClient(undefined, async (client) => {
    try {
      await client.query('DROP TABLE games cascade')
      await client.query('DROP TABLE players cascade')
    } catch (err) {
      console.log('Teardown failed')
      console.log(err.stack)
    } finally {
      console.log('Teardown complete')
    }
  })
}
