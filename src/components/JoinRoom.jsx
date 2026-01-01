import { useState } from 'react'

function JoinRoom({ onJoinRoom }) {
  const [userName, setUserName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = () => {
    if (!userName.trim()) {
      setError('Please enter your name')
      return
    }
    
    setLoading(true)
    const newRoomId = generateRoomId()
    
    // Simulate async operation
    setTimeout(() => {
      setLoading(false)
      onJoinRoom(newRoomId, userName.trim())
    }, 500)
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    
    if (!userName.trim()) {
      setError('Please enter your name')
      return
    }
    
    if (!roomId.trim()) {
      setError('Please enter a room ID')
      return
    }

    if (roomId.trim().length !== 6) {
      setError('Room ID must be 6 characters')
      return
    }

    setLoading(true)
    
    // Simulate async operation
    setTimeout(() => {
      setLoading(false)
      onJoinRoom(roomId.trim().toUpperCase(), userName.trim())
    }, 500)
  }

  return (
    <div className="join-screen">
      <div className="join-form">
        <h1>Collaborative Editor</h1>
        
        {error && <div className="error">{error}</div>}
        
        <div className="form-group">
          <label>Your Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value)
              setError('')
            }}
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>

        <button 
          className="btn" 
          onClick={handleCreateRoom}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create New Room'}
        </button>

        <div className="divider">or</div>

        <form onSubmit={handleJoinRoom}>
          <div className="form-group">
            <label>Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value.toUpperCase().slice(0, 6))
                setError('')
              }}
              placeholder="Enter room ID (e.g., ABC123)"
              maxLength={6}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn"
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default JoinRoom