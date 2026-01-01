import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

app.use(cors())

// Store rooms in memory
const rooms = new Map()

// Room class
class Room {
  constructor(id) {
    this.id = id
    this.users = new Map()
    this.content = '// Welcome to the collaborative editor!\n// Start typing to collaborate in real-time\n\nfunction hello() {\n  console.log("Hello, world!");\n}\n\nhello();'
    this.createdAt = new Date()
  }

  addUser(userId, userData) {
    this.users.set(userId, userData)
    console.log(`User ${userData.name} joined room ${this.id}`)
  }

  removeUser(userId) {
    const user = this.users.get(userId)
    if (user) {
      this.users.delete(userId)
      console.log(`User ${user.name} left room ${this.id}`)
    }
    return user
  }

  getUsers() {
    return Array.from(this.users.values())
  }

  updateContent(content) {
    this.content = content
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('join-room', (data) => {
    const { roomId, userName, color } = data
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Room(roomId))
    }
    
    const room = rooms.get(roomId)
    
    // Add user to room
    const userData = {
      id: socket.id,
      name: userName,
      color: color,
      joinedAt: new Date()
    }
    
    room.addUser(socket.id, userData)
    socket.join(roomId)
    socket.roomId = roomId
    
    // Send room data to user
    socket.emit('room-joined', {
      users: room.getUsers(),
      content: room.content
    })
    
    // Notify other users
    socket.to(roomId).emit('user-joined', userData)
  })

  socket.on('content-change', (data) => {
    const { roomId, content } = data
    console.log(`Content change in room ${roomId} from ${socket.id}:`, content.substring(0, 50))
    
    if (!rooms.has(roomId)) {
      console.log('Room not found:', roomId)
      return
    }
    
    const room = rooms.get(roomId)
    room.updateContent(content)
    
    // Broadcast to other users in the room
    console.log(`Broadcasting to ${socket.adapter.rooms.get(roomId)?.size - 1 || 0} other users`)
    socket.to(roomId).emit('content-changed', content)
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId)
      const user = room.removeUser(socket.id)
      
      if (user) {
        // Notify other users
        socket.to(socket.roomId).emit('user-left', socket.id)
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(socket.roomId)
          console.log(`Deleted empty room: ${socket.roomId}`)
        }
      }
    }
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})