import { useState, useEffect } from 'react'
import axios from 'axios'
import CourseViewer from './components/CourseViewer'
import CourseCreator from './components/CourseCreator'
import CourseList from './components/CourseList'
import AdminViewer from './components/AdminViewer'
import PasswordModal from './components/PasswordModal'
import { API_BASE_URL } from './config/api'
import './App.css'

const ADMIN_STORAGE_KEY = 'courseBuilder_adminMode'

function App() {
  const [view, setView] = useState('list') // 'list', 'create', 'view', 'admin'
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdminMode, setIsAdminMode] = useState(() => {
    // Check localStorage for admin mode
    return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true'
  })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    // Save admin mode to localStorage
    localStorage.setItem(ADMIN_STORAGE_KEY, isAdminMode.toString())
  }, [isAdminMode])

  const checkBackendHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/test-storage`, {
        timeout: 5000
      })
      return { healthy: true, message: response.data?.message }
    } catch (error) {
      return { 
        healthy: false, 
        message: error.code === 'ERR_NETWORK' || error.message === 'Network Error'
          ? 'Cannot reach backend server'
          : error.response?.data?.error || error.message
      }
    }
  }

  const loadCourses = async () => {
    try {
      setLoading(true)
      setApiError(null)
      
      // First check if backend is reachable
      const healthCheck = await checkBackendHealth()
      if (!healthCheck.healthy) {
        setApiError({
          message: `Backend server is not reachable at ${API_BASE_URL}`,
          details: healthCheck.message,
          apiUrl: API_BASE_URL
        })
        setCourses([])
        return
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/courses`, {
        timeout: 10000
      })
      setCourses(response.data)
      setApiError(null)
    } catch (error) {
      console.error('Error loading courses:', error)
      console.error('API Base URL:', API_BASE_URL)
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      })
      
      // Provide more helpful error messages
      let errorMessage = 'Error loading courses: '
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = `Cannot connect to backend API at ${API_BASE_URL}. `
        errorMessage += 'Please check if the backend server is running and accessible.'
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The backend server may be slow or unresponsive.'
      } else if (error.response) {
        errorMessage += error.response.data?.error || `${error.response.status} ${error.response.statusText}`
      } else {
        errorMessage += error.message
      }
      
      setApiError({
        message: errorMessage,
        details: error.response?.data?.details || error.message,
        apiUrl: API_BASE_URL
      })
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const handleCourseCreated = (course) => {
    setSelectedCourse(course)
    setView('view')
    loadCourses()
  }

  const handleCourseSelected = async (courseId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/course/${courseId}`)
      setSelectedCourse({
        id: courseId,
        ...response.data
      })
      setView('view')
    } catch (error) {
      console.error('Error loading course:', error)
      if (error.response?.status === 404) {
        alert('Course not found')
      } else {
        alert('Error loading course: ' + (error.response?.data?.error || error.message))
      }
    }
  }

  const handleCourseEdit = async (courseId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/course/${courseId}`)
      setSelectedCourse({
        id: courseId,
        ...response.data
      })
      setView('admin')
    } catch (error) {
      console.error('Error loading course for editing:', error)
      if (error.response?.status === 404) {
        alert('Course not found')
      } else {
        alert('Error loading course: ' + (error.response?.data?.error || error.message))
      }
    }
  }

  const handleCourseUpdated = (updatedCourse) => {
    setSelectedCourse({
      ...selectedCourse,
      ...updatedCourse
    })
    loadCourses() // Refresh the course list
  }

  const handleAdminToggle = () => {
    if (!isAdminMode) {
      // Switching to admin mode - show password modal
      setShowPasswordModal(true)
    } else {
      // Switching to expert mode - no password needed
      setIsAdminMode(false)
    }
  }

  const handlePasswordSuccess = () => {
    setIsAdminMode(true)
  }

  return (
    <div className="app">
      <nav className="navbar">
        <h1>Course Builder</h1>
        <div className="nav-buttons">
          <button 
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            Courses
          </button>
          <button 
            className={view === 'create' ? 'active' : ''}
            onClick={() => setView('create')}
          >
            Create Course
          </button>
          <div className="admin-toggle">
            <span className="toggle-label-text">Mode:</span>
            <label className="toggle-label" title={isAdminMode ? 'Switch to Expert Mode' : 'Switch to Admin Mode (Password Required)'}>
              <span className={`mode-text ${!isAdminMode ? 'active' : ''}`}>Expert</span>
              <input
                type="checkbox"
                checked={isAdminMode}
                onChange={handleAdminToggle}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
              <span className={`mode-text ${isAdminMode ? 'active' : ''}`}>Admin</span>
            </label>
          </div>
        </div>
      </nav>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />

      {apiError && (
        <div style={{
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          padding: '16px',
          margin: '16px',
          color: '#c62828'
        }}>
          <strong>Connection Error:</strong>
          <p>{apiError.message}</p>
          {apiError.details && <p style={{ fontSize: '0.9em', marginTop: '8px' }}>Details: {apiError.details}</p>}
          <p style={{ fontSize: '0.85em', marginTop: '8px', opacity: 0.8 }}>
            API URL: {apiError.apiUrl}
          </p>
          <button 
            onClick={loadCourses}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry Connection
          </button>
        </div>
      )}
      <main className="main-content">
        {view === 'list' && (
          <CourseList 
            courses={courses}
            onCourseSelect={handleCourseSelected}
            onCourseEdit={isAdminMode ? handleCourseEdit : undefined}
            onRefresh={loadCourses}
            loading={loading}
          />
        )}
        {view === 'create' && (
          <CourseCreator onCourseCreated={handleCourseCreated} />
        )}
        {view === 'view' && selectedCourse && (
          <CourseViewer 
            course={selectedCourse}
            onBack={() => setView('list')}
            onEdit={isAdminMode ? handleCourseEdit : undefined}
          />
        )}
        {view === 'admin' && selectedCourse && (
          <AdminViewer 
            course={selectedCourse}
            onBack={() => setView('list')}
            onCourseUpdated={handleCourseUpdated}
          />
        )}
      </main>
    </div>
  )
}

export default App
