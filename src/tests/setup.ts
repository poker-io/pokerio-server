import { databaseInit } from '../utils/databaseConnection'

export default async function setup() {
  await databaseInit()
  console.log('\nTest setup complete')
}
