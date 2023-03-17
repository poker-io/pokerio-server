import { port } from '../index'

test('Simple test', async () => {
  // for some reason using port from imported varaible gives weird errors
  let response = await fetch('http://localhost:42069/test')
  let text = await response.text()
  expect(text).toEqual('Hello from typescript express!')
})
