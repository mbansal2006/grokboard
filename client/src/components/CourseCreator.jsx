import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import './CourseCreator.css'

function CourseCreator({ onCourseCreated }) {
  const [folderPath, setFolderPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [files, setFiles] = useState([])

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
  }

  const handleUpload = async () => {
    if (files.length === 0 && !folderPath) {
      setError('Please select files or provide a folder path')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let response

      if (files.length > 0) {
        // Upload files
        const formData = new FormData()
        const folderId = `folder-${Date.now()}`
        files.forEach((file) => {
          formData.append('files', file)
        })
        formData.append('folderId', folderId)

        response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      } else {
        // Use folder path
        response = await axios.post(`${API_BASE_URL}/api/create-course`, {
          folderPath: folderPath,
        })
      }

      onCourseCreated(response.data.course)
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating course. Please try again.')
      console.error('Error creating course:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="course-creator">
      <h2>Create New Course</h2>
      <p className="subtitle">
        Upload markdown files or provide a folder path to generate an interactive course
      </p>

      <div className="creator-form">
        <div className="input-section">
          <label>Option 1: Upload Markdown Files</label>
          <input
            type="file"
            multiple
            accept=".md"
            onChange={handleFileSelect}
            className="file-input"
          />
          {files.length > 0 && (
            <div className="file-list">
              <p>Selected files:</p>
              <ul>
                {files.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="input-section">
          <label>Option 2: Provide Folder Path</label>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/markdown/folder"
            className="path-input"
          />
          <small>Enter the absolute path to a folder containing markdown files</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          onClick={handleUpload}
          disabled={isLoading || (files.length === 0 && !folderPath)}
          className="create-btn"
        >
          {isLoading ? 'Generating course...' : 'Create Course'}
        </button>
      </div>

      {isLoading && (
        <div className="loading">
          <p>Generating course...</p>
          <p className="loading-note">This may take a minute or two.</p>
        </div>
      )}
    </div>
  )
}

export default CourseCreator
