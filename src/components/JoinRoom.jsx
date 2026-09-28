import { useState, useEffect } from 'react'

const NEUTRAL_COLORS = [
  '#ffffff', '#cccccc', '#999999', '#777777',
  '#60a5fa', '#34d399', '#fbbf24', '#f87171'
]

function JoinRoom({ onJoinRoom }) {
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [userName, setUserName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteRoom, setInviteRoom] = useState('')

  // Check URL params for room invite (e.g. ?room=ABC123)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const roomFromQuery = urlParams.get('room')
      const roomFromHash = window.location.hash ? window.location.hash.replace('#', '') : null
      const initialRoom = (roomFromQuery || roomFromHash || '').trim().toUpperCase()

      if (initialRoom && initialRoom.length <= 10) {
        setRoomId(initialRoom)
        setInviteRoom(initialRoom)
        setTab('join')
      }
    } catch {
      // Ignore
    }
  }, [])

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = (e) => {
    e.preventDefault()
    const name = userName.trim()
    if (!name) {
      setError('Enter your name')
      return
    }

    setLoading(true)
    const newRoomId = generateRoomId()
    const assignedColor = NEUTRAL_COLORS[Math.floor(Math.random() * NEUTRAL_COLORS.length)]

    setTimeout(() => {
      setLoading(false)
      onJoinRoom(newRoomId, name, assignedColor)
    }, 150)
  }

  const handleJoinExistingRoom = (e) => {
    e.preventDefault()
    const name = userName.trim()
    const cleanRoom = roomId.trim().toUpperCase()

    if (!name) {
      setError('Enter your name')
      return
    }
    if (!cleanRoom) {
      setError('Enter a room ID')
      return
    }

    setLoading(true)
    const assignedColor = NEUTRAL_COLORS[Math.floor(Math.random() * NEUTRAL_COLORS.length)]

    setTimeout(() => {
      setLoading(false)
      onJoinRoom(cleanRoom, name, assignedColor)
    }, 150)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-header">
          <h1 className="join-title">CodeLive</h1>
          <p className="join-subtitle">Collaborative code editor</p>
        </div>

        {inviteRoom && (
          <div className="invite-banner">
            Invite to room: <strong>{inviteRoom}</strong>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <div className="tabs-header">
          <button
            type="button"
            className={`tab-btn ${tab === 'create' ? 'active' : ''}`}
            onClick={() => {
              setTab('create')
              setError('')
            }}
          >
            Create Room
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'join' ? 'active' : ''}`}
            onClick={() => {
              setTab('join')
              setError('')
            }}
          >
            Join Room
          </button>
        </div>

        <form onSubmit={tab === 'create' ? handleCreateRoom : handleJoinExistingRoom}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="input-field"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value)
                setError('')
              }}
              placeholder="Your name"
              maxLength={24}
              autoFocus
            />
          </div>

          {tab === 'join' && (
            <div className="form-group">
              <label className="form-label">Room ID</label>
              <input
                type="text"
                className="input-field mono"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value.toUpperCase().slice(0, 8))
                  setError('')
                }}
                placeholder="6-character code"
                maxLength={8}
              />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Connecting...' : tab === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default JoinRoom