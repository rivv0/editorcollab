# Real-Time Collaborative Code Editor

A professional collaborative code editor built with modern web technologies. Think Google Docs, but for code - multiple developers can edit the same document simultaneously with real-time synchronization.

##  Project Overview

This project demonstrates full-stack development skills by building a real-time collaborative application from scratch. It showcases expertise in modern JavaScript, React, WebSocket communication, and system architecture design.

##  Live Demo

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001







#### **Event-Driven Architecture**
- `join-room`: User enters collaborative session
- `content-change`: Document modifications
- `user-joined/left`: Presence management
- `room-joined`: Initial state synchronization

#### **Conflict Resolution**
- **Last-write-wins**: Simple but effective for MVP
- **Character-level updates**: Entire document sync prevents complex operational transforms
- **Position preservation**: Cursor position maintained during remote updates

### Scalability Considerations

#### **Current Architecture (MVP)**
- Single server instance
- In-memory room storage
- Direct WebSocket connections

#### **Production Scaling Path**
- **Horizontal scaling**: Multiple server instances with Redis adapter
- **Database integration**: PostgreSQL for document persistence
- **CDN integration**: Static asset delivery
- **Load balancing**: Nginx for connection distribution

## 🎨 UI/UX Design Philosophy

### **VS Code Inspired Interface**
- **Dark theme**: Reduces eye strain for developers
- **Minimal chrome**: Focus on content, not UI elements
- **Professional typography**: Consistent with developer tools

### **User Experience Priorities**
1. **Instant feedback**: Real-time typing reflection
2. **Clear user presence**: Color-coded user indicators
3. **Simple onboarding**: Name + room ID, nothing more
4. **Familiar controls**: Standard editor shortcuts and behavior

## 🔧 Development Decisions & Trade-offs

### **Simplicity Over Features**
- **Decision**: Single document per room vs. file system
- **Rationale**: Faster development, clearer user flow, easier debugging
- **Trade-off**: Less functionality but more reliable core experience



## 🔮 Future Enhancements

### **Phase 1 - Core Features**
- [ ] Multiple file support
- [ ] Syntax highlighting for more languages
- [ ] Basic user authentication
- [ ] Room persistence

### **Phase 2 - Advanced Features**
- [ ] Operational Transform for conflict resolution
- [ ] Voice/video chat integration
- [ ] Code execution environment
- [ ] Git integration

### **Phase 3 - Enterprise Features**
- [ ] Team management
- [ ] Access controls and permissions
- [ ] Audit logs and version history
- [ ] Enterprise SSO integration

---

## 🏃‍♂️ Quick Start

```bash
# Install dependencies
npm install

# Start backend server
node server.js

# Start frontend (in new terminal)
npm run dev

# Open http://localhost:3000
```

