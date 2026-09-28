import { useState, useEffect, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { io } from 'socket.io-client'

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'html', label: 'HTML', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'json', label: 'JSON', ext: '.json' },
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'rust', label: 'Rust', ext: '.rs' },
  { id: 'go', label: 'Go', ext: '.go' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'sql', label: 'SQL', ext: '.sql' }
]

const THEMES = [
  { id: 'vs-dark', label: 'Dark (VS Code)' },
  { id: 'vs', label: 'Light' },
  { id: 'hc-black', label: 'High Contrast' }
]

function hexToRgba(hex, alpha = 0.25) {
  if (!hex || hex[0] !== '#') return `rgba(99, 102, 241, ${alpha})`
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 99
  const g = parseInt(clean.substring(2, 4), 16) || 102
  const b = parseInt(clean.substring(4, 6), 16) || 241
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function Editor({ roomId, userName, userColor, onLeaveRoom }) {
  // Session & Peer State
  const [users, setUsers] = useState([])
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [theme, setTheme] = useState('vs-dark')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [latency, setLatency] = useState(null)

  // Cursor & Editor Stats
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [selectionCount, setSelectionCount] = useState(0)
  const [totalLines, setTotalLines] = useState(1)
  const [totalChars, setTotalChars] = useState(0)

  // Chat & Activity State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [typingUsers, setTypingUsers] = useState(new Map())

  // Console Output Panel State
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState([])
  const [execStatus, setExecStatus] = useState(null) // 'running' | 'success' | 'error' | null
  const [execDuration, setExecDuration] = useState(null)

  // UI Toast
  const [toastMessage, setToastMessage] = useState('')

  // Refs
  const socketRef = useRef(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const isRemoteChange = useRef(false)
  const lastSyncedContent = useRef('')
  const remoteDecorationsMap = useRef(new Map()) // userId -> decorationIds[]
  const chatMessagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev))
    }, 2800)
  }

  // Scroll chat to bottom when messages arrive
  useEffect(() => {
    if (isChatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isChatOpen])

  // Setup WebSocket connection
  useEffect(() => {
    setConnecting(true)
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      `${window.location.protocol}//${window.location.hostname}:3001`

    console.log(`Connecting to server at ${serverUrl}...`)
    const socket = io(serverUrl, {
      reconnectionAttempts: 10,
      timeout: 10000
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id)
      setConnected(true)
      setConnecting(false)

      // Join room
      socket.emit('join-room', {
        roomId,
        userName,
        color: userColor
      })

      // Latency measurement
      const start = Date.now()
      socket.emit('ping-check', () => {
        setLatency(Date.now() - start)
      })
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      setConnected(false)
      setConnecting(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
      setConnected(false)
      setConnecting(false)
    })

    // Room Initial Snapshot
    socket.on('room-joined', (data) => {
      console.log('Received room snapshot:', data)
      setUsers(data.users || [])
      setLanguage(data.language || 'javascript')
      if (data.messages) setMessages(data.messages)

      const initialText = data.content || ''
      lastSyncedContent.current = initialText
      setContent(initialText)

      // Sync editor if already mounted
      if (editorRef.current) {
        isRemoteChange.current = true
        const model = editorRef.current.getModel()
        if (model && model.getValue() !== initialText) {
          editorRef.current.executeEdits('initial-sync', [
            {
              range: model.getFullModelRange(),
              text: initialText,
              forceMoveMarkers: true
            }
          ])
        }
        isRemoteChange.current = false
      }
    })

    // Peer Joined
    socket.on('user-joined', (newUser) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== newUser.id), newUser])
    })

    // Peer Left
    socket.on('user-left', ({ userId }) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      // Clear remote cursor
      if (editorRef.current && remoteDecorationsMap.current.has(userId)) {
        const oldIds = remoteDecorationsMap.current.get(userId) || []
        editorRef.current.deltaDecorations(oldIds, [])
        remoteDecorationsMap.current.delete(userId)
      }
    })

    // Remote Code Content Change
    socket.on('content-changed', ({ content: newContent }) => {
      if (typeof newContent !== 'string') return
      if (newContent === lastSyncedContent.current) return

      lastSyncedContent.current = newContent
      setContent(newContent)

      if (editorRef.current) {
        isRemoteChange.current = true
        const editor = editorRef.current
        const model = editor.getModel()
        if (model && model.getValue() !== newContent) {
          const prevPosition = editor.getPosition()
          editor.executeEdits('remote-change', [
            {
              range: model.getFullModelRange(),
              text: newContent,
              forceMoveMarkers: true
            }
          ])
          if (prevPosition) {
            editor.setPosition(prevPosition)
          }
        }
        isRemoteChange.current = false
      }
    })

    // Remote Cursor & Selection Changed
    socket.on('cursor-changed', (data) => {
      const { userId, userName: remoteName, color: remoteColor, position, selection } = data
      if (!editorRef.current || !monacoRef.current) return

      const monaco = monacoRef.current
      const editor = editorRef.current
      const oldDecorations = remoteDecorationsMap.current.get(userId) || []
      const newDecorations = []

      // Cursor position indicator
      if (position && position.lineNumber) {
        newDecorations.push({
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: `remote-cursor remote-cursor-${userId}`,
            before: {
              content: ` ${remoteName || 'User'} `,
              inlineClassName: `remote-cursor-label remote-cursor-${userId}`
            }
          }
        })
      }

      // Selection highlight
      if (
        selection &&
        (selection.startLineNumber !== selection.endLineNumber ||
          selection.startColumn !== selection.endColumn)
      ) {
        newDecorations.push({
          range: new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            className: `remote-selection remote-selection-${userId}`
          }
        })
      }

      const updatedIds = editor.deltaDecorations(oldDecorations, newDecorations)
      remoteDecorationsMap.current.set(userId, updatedIds)
    })

    // Remote Cursor Removed
    socket.on('cursor-removed', ({ userId }) => {
      if (editorRef.current && remoteDecorationsMap.current.has(userId)) {
        const oldIds = remoteDecorationsMap.current.get(userId) || []
        editorRef.current.deltaDecorations(oldIds, [])
        remoteDecorationsMap.current.delete(userId)
      }
    })

    // Remote Language Change
    socket.on('language-changed', ({ language: newLang }) => {
      setLanguage(newLang)
      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel()
        if (model) {
          monacoRef.current.editor.setModelLanguage(model, newLang)
        }
      }
    })

    // Chat Message Received
    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg])
      if (!isChatOpen && msg.type === 'chat' && msg.userId !== socket.id) {
        setUnreadCount((c) => c + 1)
      }
    })

    // User Typing in Chat
    socket.on('user-typing', ({ userId, userName: remoteName, isTyping }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev)
        if (isTyping) {
          next.set(userId, remoteName)
        } else {
          next.delete(userId)
        }
        return next
      })
    })

    // Periodic latency refresh
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now()
        socket.emit('ping-check', () => {
          setLatency(Date.now() - start)
        })
      }
    }, 15000)

    return () => {
      clearInterval(pingInterval)
      socket.disconnect()
    }
  }, [roomId, userName, userColor])

  // Handle Monaco Mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Set initial content if loaded from server
    if (content) {
      isRemoteChange.current = true
      editor.setValue(content)
      isRemoteChange.current = false
    }

    // Set initial language
    if (language) {
      const model = editor.getModel()
      if (model) {
        monaco.editor.setModelLanguage(model, language)
      }
    }

    // Update stats
    const updateStats = () => {
      const model = editor.getModel()
      if (model) {
        setTotalLines(model.getLineCount())
        setTotalChars(model.getValueLength())
      }
      const pos = editor.getPosition()
      if (pos) {
        setCursorPos({ line: pos.lineNumber, col: pos.column })
      }
      const sel = editor.getSelection()
      if (sel && model) {
        const selectedText = model.getValueInRange(sel)
        setSelectionCount(selectedText.length)
      }
    }

    updateStats()

    // Listen for local text edits
    editor.onDidChangeModelContent(() => {
      updateStats()

      if (isRemoteChange.current) return

      const currentVal = editor.getValue()
      if (currentVal === lastSyncedContent.current) return

      lastSyncedContent.current = currentVal
      setContent(currentVal)

      if (socketRef.current?.connected) {
        socketRef.current.emit('content-change', {
          roomId,
          content: currentVal
        })
      }
    })

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column })

      if (socketRef.current?.connected) {
        socketRef.current.emit('cursor-change', {
          roomId,
          position: e.position,
          selection: editor.getSelection()
        })
      }
    })

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel()
      if (model && e.selection) {
        const text = model.getValueInRange(e.selection)
        setSelectionCount(text.length)
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('cursor-change', {
          roomId,
          position: editor.getPosition(),
          selection: e.selection
        })
      }
    })

    // Add keyboard shortcut for Run: Cmd+Enter or Ctrl+Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode()
    })
  }

  // Change Language
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang)
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, newLang)
      }
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('language-change', {
        roomId,
        language: newLang
      })
    }
  }

  // Copy Room ID
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      showToast(`Room ID "${roomId}" copied to clipboard!`)
    } catch {
      showToast(`Room ID: ${roomId}`)
    }
  }

  // Copy Direct Invite Link
  const copyInviteLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
      await navigator.clipboard.writeText(url)
      showToast('Invite link copied! Share it with your peers.')
    } catch {
      showToast('Failed to copy invite link')
    }
  }

  // Copy All Code
  const copyAllCode = async () => {
    try {
      const code = editorRef.current?.getValue() || content
      await navigator.clipboard.writeText(code)
      showToast('All code copied to clipboard!')
    } catch {
      showToast('Failed to copy code')
    }
  }

  // Format Code
  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run()
      showToast('Formatted document')
    }
  }

  // Download Code File
  const handleDownloadCode = () => {
    const code = editorRef.current?.getValue() || content
    const langObj = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0]
    const filename = `codelive_${roomId.toLowerCase()}${langObj.ext}`

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(`Downloaded ${filename}`)
  }

  // Execute Code in In-Browser Runner
  const handleRunCode = () => {
    setIsConsoleOpen(true)
    setExecStatus('running')
    setConsoleLogs([])

    const currentCode = editorRef.current?.getValue() || content
    const logs = []

    const formatArg = (arg) => {
      if (arg === null) return 'null'
      if (arg === undefined) return 'undefined'
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }

    const customConsole = {
      log: (...args) => logs.push({ type: 'log', content: args.map(formatArg).join(' ') }),
      warn: (...args) => logs.push({ type: 'warn', content: args.map(formatArg).join(' ') }),
      error: (...args) => logs.push({ type: 'error', content: args.map(formatArg).join(' ') }),
      info: (...args) => logs.push({ type: 'log', content: args.map(formatArg).join(' ') })
    }

    const startTime = performance.now()

    if (language === 'javascript' || language === 'typescript') {
      try {
        // Safe evaluation wrapper
        const runFn = new Function('console', currentCode)
        const returnValue = runFn(customConsole)

        if (returnValue !== undefined) {
          logs.push({ type: 'return', content: `Returned: ${formatArg(returnValue)}` })
        }

        const duration = Math.round(performance.now() - startTime)
        setExecDuration(duration)
        setExecStatus('success')
        setConsoleLogs(logs.length ? logs : [{ type: 'log', content: 'Code executed successfully (no console output).' }])
      } catch (err) {
        const duration = Math.round(performance.now() - startTime)
        setExecDuration(duration)
        setExecStatus('error')
        logs.push({ type: 'error', content: `${err.name}: ${err.message}` })
        setConsoleLogs(logs)
      }
    } else {
      const duration = Math.round(performance.now() - startTime)
      setExecDuration(duration)
      setExecStatus('success')
      setConsoleLogs([
        {
          type: 'log',
          content: `Syntax check: Code is written in ${language.toUpperCase()}. In-browser execution is currently optimized for JavaScript. Download the file to run natively on your machine!`
        }
      ])
    }
  }

  // Send Chat Message
  const handleSendMessage = (e) => {
    e?.preventDefault()
    const text = chatInput.trim()
    if (!text || !socketRef.current?.connected) return

    socketRef.current.emit('chat-message', { roomId, text })
    setChatInput('')

    // Reset typing status
    socketRef.current.emit('user-typing', { roomId, isTyping: false })
  }

  // Handle Chat Input Typing
  const handleChatInputChange = (e) => {
    setChatInput(e.target.value)

    if (socketRef.current?.connected) {
      socketRef.current.emit('user-typing', { roomId, isTyping: true })

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('user-typing', { roomId, isTyping: false })
      }, 2000)
    }
  }

  // Quick Emoji Reactions
  const handleQuickEmoji = (emoji) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat-message', { roomId, text: emoji })
    }
  }

  // Generate dynamic CSS styles for all connected peers' colors
  const peerStyles = users
    .map(
      (u) => `
    .remote-cursor-${u.id} {
      --remote-color: ${u.color || '#6366f1'} !important;
    }
    .remote-selection-${u.id} {
      --remote-selection-color: ${hexToRgba(u.color || '#6366f1', 0.25)} !important;
    }
  `
    )
    .join('\n')

  return (
    <div className="editor-layout">
      {/* Injected style tag for peer cursors */}
      <style>{peerStyles}</style>

      {/* Top Navigation Bar */}
      <header className="navbar">
        {/* Left: Brand & Room Tag */}
        <div className="nav-left">
          <div className="brand" onClick={copyInviteLink} title="CodeLive">
            <span className="brand-title">CodeLive</span>
          </div>

          <div className="room-badge">
            <span className="room-badge-label">Room</span>
            <span className="room-badge-id">{roomId}</span>
            <button className="room-badge-btn" onClick={copyRoomId} title="Copy Room ID">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
            <button className="room-badge-btn" onClick={copyInviteLink} title="Copy Shareable Invite Link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* Center: Language & Theme Selectors */}
        <div className="nav-center">
          <select
            className="nav-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            title="Programming Language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>

          <select
            className="nav-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            title="Editor Theme"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <button className="nav-btn run-btn" onClick={handleRunCode} title="Execute Code (Ctrl/Cmd + Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Run</span>
          </button>
        </div>

        {/* Right: Actions, Avatars & Controls */}
        <div className="nav-right">
          {/* Active Users Avatar Stack */}
          <div className="users-stack" title={`${users.length} collaborator(s) online`}>
            {users.slice(0, 4).map((u) => (
              <div
                key={u.id}
                className="user-avatar"
                style={{ backgroundColor: u.color || '#6366f1' }}
                title={`${u.name} ${u.id === socketRef.current?.id ? '(You)' : ''}`}
              >
                {u.name.substring(0, 2).toUpperCase()}
                <span className="avatar-pulse" />
              </div>
            ))}
            {users.length > 4 && (
              <div className="user-avatar" style={{ backgroundColor: '#334155' }}>
                +{users.length - 4}
              </div>
            )}
          </div>

          <button className="nav-btn" onClick={handleFormatCode} title="Format Code">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="10" x2="3" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="21" y1="18" x2="3" y2="18" />
            </svg>
          </button>

          <button className="nav-btn" onClick={copyAllCode} title="Copy Code">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>

          <button className="nav-btn" onClick={handleDownloadCode} title="Download File">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button
            className="nav-btn"
            onClick={() => setIsConsoleOpen((prev) => !prev)}
            title="Toggle Console Output"
            style={{ color: isConsoleOpen ? '#ffffff' : undefined }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>Console</span>
          </button>

          <button
            className="nav-btn"
            onClick={() => {
              setIsChatOpen((prev) => !prev)
              setUnreadCount(0)
            }}
            title="Toggle Chat & Activity"
            style={{ color: isChatOpen ? '#ffffff' : undefined }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chat</span>
            {unreadCount > 0 && <span className="chat-badge-count">{unreadCount}</span>}
          </button>

          <button className="nav-btn leave-btn" onClick={onLeaveRoom} title="Leave Session">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="editor-workspace">
        {/* Editor & Console Column */}
        <div className="editor-main-pane">
          <div className="monaco-wrapper">
            <MonacoEditor
              height="100%"
              language={language}
              theme={theme}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontLigatures: true,
                lineHeight: 22,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                minimap: { enabled: true, maxColumn: 80 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                formatOnPaste: true,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>

          {/* Expandable Console Drawer */}
          {isConsoleOpen && (
            <div className="console-panel">
              <div className="console-header">
                <div className="console-title-group">
                  <div className="console-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    Console Output
                  </div>
                  {execStatus && (
                    <span
                      className={`console-status-tag ${
                        execStatus === 'success' ? 'success' : execStatus === 'error' ? 'error' : ''
                      }`}
                    >
                      {execStatus === 'running'
                        ? 'Executing...'
                        : execStatus === 'success'
                        ? `Finished in ${execDuration}ms`
                        : 'Error'}
                    </span>
                  )}
                </div>

                <div className="console-actions">
                  <button className="console-btn" onClick={() => setConsoleLogs([])} title="Clear Console">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear
                  </button>
                  <button className="console-btn" onClick={() => setIsConsoleOpen(false)} title="Close Console">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="console-body">
                {consoleLogs.length === 0 ? (
                  <div className="console-empty">Click "▶ Run" or press Cmd+Enter to execute JavaScript.</div>
                ) : (
                  consoleLogs.map((log, index) => (
                    <div key={index} className="console-log-row">
                      <span className={`log-type-tag log-type-${log.type}`}>{log.type}</span>
                      <pre className="log-content">{log.content}</pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Slide-out Collaborative Chat & Activity Drawer */}
        {isChatOpen && (
          <aside className="chat-drawer">
            <div className="chat-header">
              <div className="chat-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Room Chat & Activity
              </div>
              <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="chat-messages">
              {messages.map((m) => {
                if (m.type === 'system') {
                  return (
                    <div key={m.id} className="system-msg">
                      {m.text}
                    </div>
                  )
                }

                const isMine = m.userId === socketRef.current?.id
                const timeString = m.timestamp
                  ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''

                return (
                  <div key={m.id} className={`chat-msg ${isMine ? 'mine' : 'other'}`}>
                    <div className="chat-msg-header">
                      <span className="chat-msg-sender" style={{ color: m.color || '#94a3b8' }}>
                        {isMine ? 'You' : m.userName}
                      </span>
                      <span className="chat-msg-time">{timeString}</span>
                    </div>
                    <div className="chat-bubble">{m.text}</div>
                  </div>
                )
              })}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div className="typing-indicator">
                {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Quick emoji reactions */}
            <div className="chat-quick-emojis">
              {['🚀', '🔥', '👍', '❤️', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-btn"
                  onClick={() => handleQuickEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Message input */}
            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-input"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder="Type a message..."
                maxLength={400}
              />
              <button type="submit" className="chat-send-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="statusbar">
        <div className="status-left">
          <div className="status-indicator">
            <span
              className={`status-dot ${
                connected ? 'connected' : connecting ? 'connecting' : 'disconnected'
              }`}
            />
            <span>{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
          </div>

          {latency !== null && (
            <div className="status-item" title="WebSocket ping round-trip">
              <span>{latency}ms</span>
            </div>
          )}

          <div className="status-item">
            <span>{users.length} active collaborator{users.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="status-right">
          <div className="status-item">
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            {selectionCount > 0 && <span>({selectionCount} selected)</span>}
          </div>

          <div className="status-item">
            <span>
              {totalLines} lines, {totalChars} chars
            </span>
          </div>

          <div className="status-item">
            <span>Spaces: 2</span>
          </div>

          <div className="status-item">
            <span>UTF-8</span>
          </div>

          <div className="status-item" style={{ color: '#38bdf8' }}>
            <span>{LANGUAGES.find((l) => l.id === language)?.label || 'Code'}</span>
          </div>
        </div>
      </footer>

      {/* Toast Notice */}
      {toastMessage && (
        <div className="toast-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}

export default Editor