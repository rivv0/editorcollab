import { useState, useEffect, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { io } from 'socket.io-client'

function Editor({ roomId, userName, onLeaveRoom }) {
  const [users, setUsers] = useState([])
  const [content, setContent] = useState('// Welcome to the collaborative editor!\n// Start typing to collaborate in real-time\n\nfunction hello() {\n  console.log("Hello, world!");\n}\n\nhello();')
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const editorRef = useRef(null)
  const isRemoteChange = useRef(false)

  // User colors
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ]

  useEffect(() => {
    // Connect to server
    const newSocket = io('http://localhost:3001')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setConnected(true)
      
      // Join room
      console.log('Joining room:', roomId, 'as', userName)
      newSocket.emit('join-room', {
        roomId,
        userName,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    })

    newSocket.on('disconnect', () => {
      setConnected(false)
    })

    // Handle room events
    newSocket.on('room-joined', (data) => {
      console.log('Room joined successfully:', data)
      setUsers(data.users)
      setContent(data.content)
      
      // Update editor with room content if it's mounted
      if (editorRef.current && data.content !== content) {
        console.log('Setting room content in editor')
        editorRef.current.setValue(data.content)
      }
    })

    newSocket.on('user-joined', (user) => {
      setUsers(prev => [...prev.filter(u => u.id !== user.id), user])
    })

    newSocket.on('user-left', (userId) => {
      setUsers(prev => prev.filter(u => u.id !== userId))
    })

    newSocket.on('content-changed', (newContent) => {
      console.log('Received content change:', newContent.substring(0, 50))
      isRemoteChange.current = true
      
      // Update editor if it exists
      if (editorRef.current) {
        const editor = editorRef.current
        const currentContent = editor.getValue()
        
        if (currentContent !== newContent) {
          const position = editor.getPosition()
          editor.setValue(newContent)
          if (position) {
            editor.setPosition(position)
          }
        }
      }
      
      setContent(newContent)
      
      setTimeout(() => {
        isRemoteChange.current = false
      }, 100)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [roomId, userName])

  const handleEditorDidMount = (editor) => {
    console.log('Editor mounted')
    editorRef.current = editor
    
    // Set initial content
    editor.setValue(content)
    
    // Listen for changes
    editor.onDidChangeModelContent(() => {
      if (isRemoteChange.current) {
        console.log('Skipping remote change')
        return
      }
      
      const newContent = editor.getValue()
      console.log('Local content change:', newContent.substring(0, 50))
      setContent(newContent)
      
      if (socket && connected) {
        console.log('Emitting content change to room:', roomId)
        socket.emit('content-change', {
          roomId,
          content: newContent
        })
      } else {
        console.log('Not connected, cannot emit change')
      }
    })
    
    console.log('Editor setup complete')
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
    } catch (err) {
      console.error('Failed to copy room ID')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="logo">Collaborative Editor</div>
        
        <div className="room-info">
          <span>Room:</span>
          <span className="room-id" onClick={copyRoomId} style={{ cursor: 'pointer' }}>
            {roomId}
          </span>
          <span>{connected ? 'Connected' : 'Connecting...'}</span>
        </div>

        <div className="users">
          <span>Users ({users.length}):</span>
          {users.slice(0, 5).map(user => (
            <div key={user.id} className="user">
              <div 
                className="user-dot" 
                style={{ backgroundColor: user.color }}
              />
              <span>{user.name}</span>
            </div>
          ))}
          {users.length > 5 && <span>+{users.length - 5}</span>}
          
          <button 
            onClick={onLeaveRoom}
            style={{
              background: '#f14c4c',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginLeft: '12px'
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="editor-container">
        <MonacoEditor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on'
          }}
        />
      </div>
    </div>
  )
}

export default Editor