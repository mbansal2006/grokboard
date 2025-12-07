import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import './CourseList.css'

function CourseList({ courses, onCourseSelect, onCourseEdit, onRefresh, loading }) {
  const handleExport = async (courseId, courseTitle) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/export/${courseId}`, {
        responseType: 'blob',
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${courseTitle.replace(/\s+/g, '-')}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error exporting course:', error)
      alert('Error exporting course. Please try again.')
    }
  }

  return (
    <div className="course-list">
      <div className="course-list-header">
        <h2>Your Courses</h2>
        <button onClick={onRefresh} className="refresh-btn" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <p>No courses yet. Create your first course!</p>
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((course) => (
            <div key={course.id} className="course-card">
              <h3>{course.title}</h3>
              <p className="course-description">{course.description}</p>
              <div className="course-meta">
                <span>{course.lessonCount} lessons</span>
                <span>{new Date(course.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="course-actions">
                <button
                  onClick={() => onCourseSelect(course.id)}
                  className="btn btn-primary"
                >
                  View Course
                </button>
                {onCourseEdit && (
                  <button
                    onClick={() => onCourseEdit(course.id)}
                    className="btn btn-admin"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleExport(course.id, course.title)}
                  className="btn btn-secondary"
                >
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CourseList
