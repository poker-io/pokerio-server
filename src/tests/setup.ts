import { databaseInit } from '../utils/databaseConnection'

module.exports = async function teardown() {
  await databaseInit()
  console.log('Test setup complete')
}
