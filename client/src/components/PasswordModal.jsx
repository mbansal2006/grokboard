import { useState } from 'react'
import './PasswordModal.css'

const ADMIN_PASSWORD = 'HurdHall341!'

function PasswordModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (password === ADMIN_PASSWORD) {
      onSuccess()
      setPassword('')
      onClose()
    } else {
      setError('Incorrect password. Please try again.')
      setPassword('')
    }
  }

  const handleCancel = () => {
    setPassword('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="password-modal-overlay" onClick={handleCancel}>
      <div className="password-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Enter Admin Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="Enter password"
              className={error ? 'error' : ''}
              autoFocus
            />
            {error && <div className="error-message">{error}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={handleCancel} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PasswordModal
