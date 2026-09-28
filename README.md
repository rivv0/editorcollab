# ⚡ CodeLive — Real-Time Collaborative Code Studio

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socketdotio&logoColor=white)
![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.46-007ACC?logo=visualstudiocode&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)

**A high-performance multiplayer code editor designed for pair programming, technical interviews, and real-time team collaboration.**

[Features](#-key-features) • [Quick Start](#-quick-start) • [Architecture](#-system-architecture) • [WebSocket Protocol](#-websocket-event-specification) • [Testing](#-automated-tests) • [Deployment](#-production-deployment)

</div>

---

## 🌟 Overview

**CodeLive** delivers a seamless, Google Docs-style collaboration experience built specifically for developers. Powered by **React 18**, **Monaco Editor (VS Code engine)**, **Express**, and **Socket.IO**, multiple developers can write, run, debug, and review code simultaneously with zero configuration.

---

## ✨ Key Features

### 👥 Multiplayer Live Cursors & Presence
- **Color-Coded Cursors**: Every peer receives a unique cursor color and floating username badge that tracks their movements across lines and columns in real-time.
- **Selection Highlights**: Watch collaborators highlight and select blocks of code live without clipping or lag.
- **Active Peer Stack**: Real-time avatar tray in the navigation bar displaying all connected users and their live status.

### ⚡ Sub-Millisecond Synchronization
- **Non-Destructive Buffer Edits**: Uses Monaco's `executeEdits` model instead of destructive buffer re-creation, preserving local cursor position, active selections, and edit history.
- **Ping / Latency Telemetry**: Live network latency meter directly in the status bar (e.g. `12ms`).

### ▶️ Built-In Sandboxed Code Runner
- **Instant In-Browser Execution**: Execute JavaScript code directly with keyboard shortcuts (`Cmd/Ctrl + Enter`) or the "Run" button.
- **Console Capture**: Intercepts `console.log`, `warn`, `error`, and `info` with timestamped logs, execution timing (`Finished in 8ms`), and colored output drawers.
- **Output Inspection**: Clean collapsible console drawer with clear logs, execution stats, and formatted return values.

### 🌐 12+ Programming Languages & Syntax Highlighting
- Seamless syntax highlighting and grammar parsing for:
  - **JavaScript**, **TypeScript**, **Python**, **HTML**, **CSS**, **JSON**, **Markdown**, **Rust**, **Go**, **C++**, **Java**, **SQL**.
- **Synchronized Language Switching**: When a collaborator changes the room language, all participants' editors immediately update syntax highlighting.

### 💬 Real-Time In-Session Chat & Activity
- **Integrated Sidebar Chat**: Communicate directly beside your code without leaving the editor.
- **System Activity Notifications**: Automatic notices when users join, leave, or change language settings.
- **Typing Indicators**: Visual feedback when peers are composing messages.
- **Quick Reaction Emojis**: 1-click emoji reactions (`🚀`, `🔥`, `👍`, `❤️`, `🎉`).
- **Unread Badge Counters**: Notification indicator on the Chat button so you never miss messages while focused on code.

### 🔗 1-Click Session Sharing & URL Invites
- **Direct Link Joining**: Share URLs formatted as `http://localhost:3000/?room=ABC123`. Recipients auto-fill the session code and can join immediately.
- **Interactive Landing Screen**: Create rooms with 1 click, choose custom cursor colors, generate fun developer aliases (`🎲 Random`), and enter existing sessions.

### 🎨 Glassmorphic Dark Design
- Engineered with curated dark palettes, glowing accents, Google Fonts typography (`Inter` and `JetBrains Mono`), smooth transitions, and responsive layout.

---

## 🏃‍♂️ Quick Start

### Prerequisites
- **Node.js** v18.0 or higher
- **npm** v9.0 or higher

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/rivv0/editorcollab.git
cd codelive

# Install dependencies (or run in simple-collab-editor)
npm run install:all
```

### 2. Start Development Servers (Single Command)
Run both the frontend client and backend server concurrently with a single command:
```bash
npm run dev
```

This starts:
- 🌐 **Frontend Studio**: `http://localhost:3000`
- 📡 **Backend & WebSockets**: `http://localhost:3001`

### 3. Open in Browser
Open `http://localhost:3000` in two different browser windows or tabs to test real-time collaboration instantly!

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│                                                             │
│   ┌────────────────────┐          ┌──────────────────────┐  │
│   │    Monaco Editor   │          │   CodeLive Studio    │  │
│   │ (executeEdits,     │◄────────►│   State Manager      │  │
│   │  Decorations API)  │          │   (Cursors, Chat)    │  │
│   └────────────────────┘          └──────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                               WebSocket / WSS │ Socket.IO
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express & Socket.IO Server               │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                     Room Manager                    │   │
│   │  - Ephemeral Rooms Map    - User Presence & Colors  │   │
│   │  - Document Buffer        - Message History Stream  │   │
│   │  - Cursor Broadcasting    - Language Synchronization│   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   REST Endpoints:                                           │
│   • GET /health          • GET /api/stats                   │
│   • GET /api/rooms/:id                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 WebSocket Event Specification

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join-room` | Client ➔ Server | `{ roomId, userName, color }` | Joins a collaborative session |
| `room-joined` | Server ➔ Client | `{ roomId, users, content, language, messages }` | Delivers initial session snapshot |
| `user-joined` | Server ➔ Broadcast | `{ id, name, color, joinedAt }` | Notifies room of a new participant |
| `user-left` | Server ➔ Broadcast | `{ userId, userName }` | Notifies room that a peer disconnected |
| `content-change` | Client ➔ Server | `{ roomId, content }` | Submits local code buffer edits |
| `content-changed` | Server ➔ Broadcast | `{ content, senderId }` | Broadcasts new code to other room peers |
| `cursor-change` | Client ➔ Server | `{ roomId, position, selection }` | Sends local cursor line/col & selection |
| `cursor-changed` | Server ➔ Broadcast | `{ userId, userName, color, position, selection }` | Renders peer cursor & selection decorations |
| `cursor-removed` | Server ➔ Broadcast | `{ userId }` | Removes remote peer cursor on disconnect |
| `language-change` | Client ➔ Server | `{ roomId, language }` | Requests language switch |
| `language-changed`| Server ➔ All | `{ language, changedBy }` | Updates syntax highlighting for all peers |
| `chat-message` | Bidirectional | `{ id, type, userId, userName, color, text, timestamp }` | Dispatches session chat and system events |
| `user-typing` | Bidirectional | `{ userId, userName, isTyping }` | Broadcasts typing indicator in chat |
| `ping-check` | Client ➔ Server | `callback()` | Calculates round-trip network latency |

---

## ⌨️ Editor Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd + Enter` / `Ctrl + Enter` | **Execute Code** in safe runner |
| `Shift + Alt + F` | **Format Document** |
| `Cmd + F` / `Ctrl + F` | Find / Replace |
| `Cmd + /` / `Ctrl + /` | Toggle Line Comment |
| `Alt + Up / Down` | Move Line Up / Down |
| `Cmd + D` / `Ctrl + D` | Add Next Matching Selection |

---

## 🧪 Automated Tests

An automated end-to-end integration test is included to verify all synchronization features:

```bash
npm test
```

### What the test validates:
1. Two simultaneous socket client connections
2. Room creation and initial state synchronization
3. Real-time code content updates
4. Multiplayer cursor & selection presence
5. Synchronized language switching
6. Chat messaging and broadcast delivery

---

## 📂 Project Structure

```
codelive/
├── package.json                 # Root script delegator (dev, build, test, start)
├── .gitignore                   # Ignore rules for repo
├── README.md                    # Project documentation
└── simple-collab-editor/
    ├── package.json             # Core dependencies and scripts
    ├── server.js                # Express & Socket.IO collaborative backend
    ├── test-collab.js           # Automated collaboration integration test suite
    ├── vite.config.js           # Vite dev server configuration (port 3000)
    ├── index.html               # Entry HTML with Google Fonts & responsive meta
    └── src/
        ├── main.jsx             # React DOM root mounting
        ├── App.jsx              # Session routing, state & URL synchronization
        ├── index.css            # Complete design system & glassmorphism theme
        └── components/
            ├── JoinRoom.jsx     # Landing page, room generator, color picker
            └── Editor.jsx       # Monaco Editor, cursors, runner, chat, status bar
```

---

## ⚙️ Configuration & Environment

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3001` | Backend Express & WebSocket server port |
| `VITE_SERVER_URL` | Auto (`window.location.hostname:3001`) | Custom WebSocket server URL if deployed separately |

---

## 🚀 Production Deployment

### 1. Build the Frontend
```bash
npm run build
```
The optimized production bundle is generated inside `simple-collab-editor/dist`.

### 2. Start the Production Backend
```bash
npm start
```

### 3. Deploying with Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN npm run build
EXPOSE 3000 3001
CMD ["npm", "run", "dev"]
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
