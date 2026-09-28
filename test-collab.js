import { io } from 'socket.io-client'
import { spawn } from 'child_process'
import http from 'http'

const SERVER_URL = 'http://localhost:3001'
const ROOM_ID = 'TEST99'

console.log('--- Starting CodeLive Automated Integration Test ---')

let spawnedServer = null

function checkServerAlive() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/health`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(600, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function runTest() {
  const isRunning = await checkServerAlive()
  if (!isRunning) {
    console.log('Starting local server instance for test...')
    spawnedServer = spawn('node', ['server.js'], { stdio: 'ignore' })
    // Wait for server to start
    let ready = false
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 200))
      ready = await checkServerAlive()
      if (ready) break
    }
    if (!ready) {
      throw new Error('Failed to start test server')
    }
  }

  const client1 = io(SERVER_URL)
  const client2 = io(SERVER_URL)

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)
    let count = 0
    client1.on('connect', () => {
      console.log('✓ Client 1 connected:', client1.id)
      count++
      if (count === 2) {
        clearTimeout(timeout)
        resolve()
      }
    })
    client2.on('connect', () => {
      console.log('✓ Client 2 connected:', client2.id)
      count++
      if (count === 2) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  // Client 1 joins room
  console.log('Client 1 joining room', ROOM_ID)
  client1.emit('join-room', {
    roomId: ROOM_ID,
    userName: 'Alice',
    color: '#ffffff'
  })

  await new Promise((resolve) => {
    client1.once('room-joined', (data) => {
      console.log('✓ Client 1 received room-joined. Initial language:', data.language)
      resolve()
    })
  })

  // Client 2 joins room
  console.log('Client 2 joining room', ROOM_ID)
  client2.emit('join-room', {
    roomId: ROOM_ID,
    userName: 'Bob',
    color: '#888888'
  })

  await new Promise((resolve) => {
    client2.once('room-joined', (data) => {
      console.log('✓ Client 2 received room-joined. Peers:', data.users.map((u) => u.name).join(', '))
      resolve()
    })
  })

  // Test 1: Content Sync
  console.log('\nTesting Real-Time Code Sync...')
  const testCode = 'const greeting = "Hello from Alice!";\nconsole.log(greeting);'

  const contentPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for content-changed')), 3000)
    client2.on('content-changed', (data) => {
      clearTimeout(timer)
      if (data.content === testCode) {
        console.log('✓ Client 2 received matching content from Client 1')
        resolve()
      } else {
        reject(new Error(`Content mismatch: ${data.content}`))
      }
    })
  })

  client1.emit('content-change', {
    roomId: ROOM_ID,
    content: testCode
  })

  await contentPromise

  // Test 2: Cursor & Selection Sync
  console.log('\nTesting Live Multiplayer Cursor Presence...')
  const cursorPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for cursor-changed')), 3000)
    client2.on('cursor-changed', (data) => {
      clearTimeout(timer)
      if (data.position && data.position.lineNumber === 2 && data.userName === 'Alice') {
        console.log(`✓ Client 2 received cursor update for ${data.userName} at Ln ${data.position.lineNumber}, Col ${data.position.column}`)
        resolve()
      }
    })
  })

  client1.emit('cursor-change', {
    roomId: ROOM_ID,
    position: { lineNumber: 2, column: 15 },
    selection: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 15 }
  })

  await cursorPromise

  // Test 3: Language Sync
  console.log('\nTesting Language Sync...')
  const langPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for language-changed')), 3000)
    client2.on('language-changed', (data) => {
      clearTimeout(timer)
      if (data.language === 'python') {
        console.log(`✓ Client 2 received language change to "${data.language}" by ${data.changedBy}`)
        resolve()
      }
    })
  })

  client1.emit('language-change', {
    roomId: ROOM_ID,
    language: 'python'
  })

  await langPromise

  // Test 4: Chat & Activity Message
  console.log('\nTesting Chat & Activity Messaging...')
  const chatPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for chat-message')), 3000)
    client2.on('chat-message', (msg) => {
      if (msg.type === 'chat' && msg.text === 'Minimal and functional!') {
        clearTimeout(timer)
        console.log(`✓ Client 2 received chat message: "${msg.text}" from ${msg.userName}`)
        resolve()
      }
    })
  })

  client1.emit('chat-message', {
    roomId: ROOM_ID,
    text: 'Minimal and functional!'
  })

  await chatPromise

  // Disconnect
  client1.disconnect()
  client2.disconnect()

  if (spawnedServer) {
    spawnedServer.kill()
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log('\n========================================================')
  console.log('✓ ALL 4 REAL-TIME COLLABORATIVE INTEGRATION TESTS PASSED!')
  console.log('========================================================\n')
  process.exit(0)
}

runTest().catch((err) => {
  if (spawnedServer) spawnedServer.kill()
  console.error('Test failed:', err)
  process.exit(1)
})
