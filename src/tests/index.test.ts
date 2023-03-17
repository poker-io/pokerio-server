test('Simple test', async () => {
  // for some reason using port from imported varaible gives weird errors
  const response = await fetch('http://localhost:42069/test')
  const text = await response.text()
  expect(text).toEqual('Hello from typescript express!')
})
