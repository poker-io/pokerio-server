import { getClient } from '../utils/databaseConnection'

module.exports = async function teardown() {
  const client = getClient()
  client
    .connect()
    .then(async () => {
      await client.query('DELETE FROM games casdcade')
      await client.query('DELETE FROM players cascade')
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
