import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const server = createServer(app)

// Permissive CORS so dev clients, previews, and network IP addresses can connect smoothly
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: false
  }
})

app.use(cors())
app.use(express.json())

// Starter template for new sessions
const DEFAULT_CODE = `// Collaborative Editor

function main() {
  console.log("Hello, world!");
}

main();
`

// In-memory room store
const rooms = new Map()

class Room {
  constructor(id) {
    this.id = id
    this.users = new Map() // socketId -> userData
    this.content = DEFAULT_CODE
    this.language = 'javascript'
    this.messages = [] // chat & activity history
    this.createdAt = new Date()
    this.lastActivity = new Date()
  }

  addUser(userId, userData) {
    this.users.set(userId, userData)
    this.lastActivity = new Date()
    console.log(`[Room ${this.id}] User joined: ${userData.name} (${userId}) | Active users: ${this.users.size}`)
  }

  removeUser(userId) {
    const user = this.users.get(userId)
    if (user) {
      this.users.delete(userId)
      this.lastActivity = new Date()
      console.log(`[Room ${this.id}] User left: ${user.name} (${userId}) | Remaining users: ${this.users.size}`)
    }
    return user
  }

  getUsers() {
    return Array.from(this.users.values())
  }

  updateContent(content) {
    this.content = content
    this.lastActivity = new Date()
  }

  setLanguage(language) {
    this.language = language
    this.lastActivity = new Date()
  }

  addMessage(message) {
    this.messages.push(message)
    if (this.messages.length > 100) {
      this.messages.shift()
    }
    this.lastActivity = new Date()
    return message
  }
}

// REST Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeRooms: rooms.size
  })
})

app.get('/api/stats', (req, res) => {
  let totalUsers = 0
  for (const room of rooms.values()) {
    totalUsers += room.users.size
  }
  res.json({
    activeRooms: rooms.size,
    totalConnectedUsers: totalUsers
  })
})

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params
  const room = rooms.get(roomId.toUpperCase())
  if (!room) {
    return res.status(404).json({ exists: false, message: 'Room not found' })
  }
  res.json({
    exists: true,
    roomId: room.id,
    language: room.language,
    userCount: room.users.size,
    createdAt: room.createdAt
  })
})

// WebSocket Real-time Handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Ping/latency measurement
  socket.on('ping-check', (cb) => {
    if (typeof cb === 'function') cb()
  })

  // Join Room
  socket.on('join-room', (data) => {
    const rawRoomId = data?.roomId || 'GLOBAL'
    const roomId = rawRoomId.toString().trim().toUpperCase()
    const userName = (data?.userName || 'Anonymous').toString().trim().slice(0, 24)
    const color = data?.color || '#6366f1'

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Room(roomId))
    }

    const room = rooms.get(roomId)
    const userData = {
      id: socket.id,
      name: userName,
      color: color,
      joinedAt: new Date().toISOString()
    }

    room.addUser(socket.id, userData)
    socket.join(roomId)
    socket.roomId = roomId
    socket.userData = userData

    // Send complete current room snapshot to the joining user
    socket.emit('room-joined', {
      roomId: room.id,
      users: room.getUsers(),
      content: room.content,
      language: room.language,
      messages: room.messages
    })

    // Notify other peers in the room
    socket.to(roomId).emit('user-joined', userData)

    // Add & broadcast system notification
    const systemJoinMsg = {
      id: 'sys-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'system',
      text: `${userName} joined the session`,
      timestamp: new Date().toISOString()
    }
    room.addMessage(systemJoinMsg)
    io.to(roomId).emit('chat-message', systemJoinMsg)
  })

  // Code Content Change
  socket.on('content-change', (data) => {
    const roomId = data?.roomId || socket.roomId
    if (!roomId || !rooms.has(roomId)) return

    const room = rooms.get(roomId)
    const newContent = typeof data.content === 'string' ? data.content : ''
    room.updateContent(newContent)

    // Broadcast change to all OTHER users in the room
    socket.to(roomId).emit('content-changed', {
      content: newContent,
      senderId: socket.id
    })
  })

  // Cursor & Selection Presence Change
  socket.on('cursor-change', (data) => {
    const roomId = data?.roomId || socket.roomId
    if (!roomId || !rooms.has(roomId)) return

    socket.to(roomId).emit('cursor-changed', {
      userId: socket.id,
      userName: socket.userData?.name || 'Collaborator',
      color: socket.userData?.color || '#6366f1',
      position: data.position,
      selection: data.selection
    })
  })

  // Language Change
  socket.on('language-change', (data) => {
    const roomId = data?.roomId || socket.roomId
    if (!roomId || !rooms.has(roomId)) return

    const room = rooms.get(roomId)
    const newLanguage = data.language || 'javascript'
    room.setLanguage(newLanguage)

    io.to(roomId).emit('language-changed', {
      language: newLanguage,
      changedBy: socket.userData?.name || 'Someone'
    })

    const systemLangMsg = {
      id: 'sys-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'system',
      text: `${socket.userData?.name || 'A user'} changed language to ${newLanguage}`,
      timestamp: new Date().toISOString()
    }
    room.addMessage(systemLangMsg)
    io.to(roomId).emit('chat-message', systemLangMsg)
  })

  // Chat Messages
  socket.on('chat-message', (data) => {
    const roomId = data?.roomId || socket.roomId
    if (!roomId || !rooms.has(roomId)) return

    const text = (data.text || '').toString().trim()
    if (!text) return

    const room = rooms.get(roomId)
    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'chat',
      userId: socket.id,
      userName: socket.userData?.name || 'Collaborator',
      color: socket.userData?.color || '#6366f1',
      text: text.slice(0, 500),
      timestamp: new Date().toISOString()
    }

    room.addMessage(message)
    io.to(roomId).emit('chat-message', message)
  })

  // User Typing Status
  socket.on('user-typing', (data) => {
    const roomId = data?.roomId || socket.roomId
    if (!roomId || !rooms.has(roomId)) return

    socket.to(roomId).emit('user-typing', {
      userId: socket.id,
      userName: socket.userData?.name || 'Collaborator',
      isTyping: !!data.isTyping
    })
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    const roomId = socket.roomId

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId)
      const user = room.removeUser(socket.id)

      if (user) {
        // Clear remote cursor for other peers
        socket.to(roomId).emit('cursor-removed', { userId: socket.id })

        // Notify other peers of user exit
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          userName: user.name
        })

        // Broadcast system activity message
        const systemLeaveMsg = {
          id: 'sys-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          type: 'system',
          text: `${user.name} left the session`,
          timestamp: new Date().toISOString()
        }
        room.addMessage(systemLeaveMsg)
        socket.to(roomId).emit('chat-message', systemLeaveMsg)

        // Remove empty rooms after a short grace period
        if (room.users.size === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
              rooms.delete(roomId)
              console.log(`[Room ${roomId}] Cleaned up empty room`)
            }
          }, 60000) // 1 minute grace period for reconnects
        }
      }
    }
  })
})

const PORT = process.env.PORT || 3001

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`)
    console.error(`   To free port ${PORT}, run: npx kill-port ${PORT}\n`)
    process.exit(1)
  } else {
    console.error('Server error:', err)
  }
})

server.listen(PORT, () => {
  console.log(`\n🚀 CodeLive Server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket ready for real-time collaboration\n`)
})