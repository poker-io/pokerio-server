import {
  databaseShutdown,
  runRequestWithClient,
} from '../utils/databaseConnection'

export default async function () {
  await runRequestWithClient(undefined, async (client) => {
    try {
      await client.query('DROP TABLE games cascade')
      await client.query('DROP TABLE players cascade')
    } catch (err) {
      console.log('Teardown failed')
      console.log(err.stack)
    }
  })

  await databaseShutdown()
  console.log('Teardown complete')
}
