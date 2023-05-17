import { getClient } from '../utils/databaseConnection'

module.exports = async function teardown() {
  const client = getClient()
  client
    .connect()
    .then(async () => {
      await client.query('DROP TABLE players cascade')
      await client.query('DROP TABLE games cascade')
    })
    .catch((err) => {
      console.log('Teardown failed')
      console.log(err.stack)
    })
    .finally(async () => {
      await client.end()
    })
}
