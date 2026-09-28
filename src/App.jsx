import { useState, useEffect } from 'react'
import JoinRoom from './components/JoinRoom'
import Editor from './components/Editor'

function App() {
  const [roomId, setRoomId] = useState(null)
  const [userName, setUserName] = useState('')
  const [userColor, setUserColor] = useState('#6366f1')

  // Auto-restore session from URL if already joined, or handle refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    const savedName = localStorage.getItem('codelive_username')
    const savedColor = localStorage.getItem('codelive_usercolor')

    if (savedName) setUserName(savedName)
    if (savedColor) setUserColor(savedColor)

    // If both room in URL and saved username exist, can prompt or auto-fill
  }, [])

  const handleJoinRoom = (targetRoomId, targetUserName, targetColor) => {
    setRoomId(targetRoomId)
    setUserName(targetUserName)
    setUserColor(targetColor || '#6366f1')

    // Persist user preference
    localStorage.setItem('codelive_username', targetUserName)
    if (targetColor) localStorage.setItem('codelive_usercolor', targetColor)

    // Update URL query param cleanly without reload
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('room', targetRoomId)
      window.history.pushState({}, '', url.toString())
    } catch {
      // Safe fallback
    }
  }

  const handleLeaveRoom = () => {
    setRoomId(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('room')
      window.history.pushState({}, '', url.pathname)
    } catch {
      // Safe fallback
    }
  }

  return (
    <>
      {roomId ? (
        <Editor
          roomId={roomId}
          userName={userName}
          userColor={userColor}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <JoinRoom onJoinRoom={handleJoinRoom} />
      )}
    </>
  )
}

export default App