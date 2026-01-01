import { useState } from 'react'
import JoinRoom from './components/JoinRoom'
import Editor from './components/Editor'

function App() {
  const [roomId, setRoomId] = useState(null)
  const [userName, setUserName] = useState('')

  const handleJoinRoom = (roomId, userName) => {
    setRoomId(roomId)
    setUserName(userName)
  }

  const handleLeaveRoom = () => {
    setRoomId(null)
    setUserName('')
  }

  return (
    <>
      {roomId ? (
        <Editor 
          roomId={roomId} 
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <JoinRoom onJoinRoom={handleJoinRoom} />
      )}
    </>
  )
}

export default App