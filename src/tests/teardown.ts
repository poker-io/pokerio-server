import { getClient } from '../utils/databaseConnection'

export default async function teardown() {
  const client = getClient()
  client
    .connect()
    .then(async () => {
      // await client.query('DROP TABLE games cascade')
      // await client.query('DROP TABLE players cascade')
    })
    .catch((err) => {
      console.log('Teardown failed')
      console.log(err.stack)
    })
    .finally(async () => {
      console.log('Teardown complete')
      await client.end()
    })
}
