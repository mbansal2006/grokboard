import { useState, useEffect } from 'react'
import { marked } from 'marked'
import Editor from '@monaco-editor/react'
import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import './AdminViewer.css'

function AdminViewer({ course, onBack, onCourseUpdated }) {
  const [editedCourse, setEditedCourse] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)
  const [expandedLessons, setExpandedLessons] = useState({})
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [expandedExercises, setExpandedExercises] = useState({})

  useEffect(() => {
    // Deep clone the course for editing
    setEditedCourse(JSON.parse(JSON.stringify(course)))
  }, [course])

  const toggleLesson = (lessonId) => {
    setExpandedLessons((prev) => ({ ...prev, [lessonId]: !prev[lessonId] }))
  }

  const toggleQuestion = (questionKey) => {
    setExpandedQuestions((prev) => ({ ...prev, [questionKey]: !prev[questionKey] }))
  }

  const toggleExercise = (exerciseId) => {
    setExpandedExercises((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }))
  }

  const updateCourseField = (field, value) => {
    setEditedCourse((prev) => ({ ...prev, [field]: value }))
  }

  const updateLessonField = (lessonIndex, field, value) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      updated.lessons[lessonIndex] = { ...updated.lessons[lessonIndex], [field]: value }
      return updated
    })
  }

  const updateQuestionField = (lessonIndex, questionIndex, field, value) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      updated.lessons[lessonIndex].questions[questionIndex] = {
        ...updated.lessons[lessonIndex].questions[questionIndex],
        [field]: value
      }
      return updated
    })
  }

  const updateQuestionOption = (lessonIndex, questionIndex, optionIndex, value) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      const options = [...updated.lessons[lessonIndex].questions[questionIndex].options]
      options[optionIndex] = value
      updated.lessons[lessonIndex].questions[questionIndex].options = options
      return updated
    })
  }

  const addQuestionOption = (lessonIndex, questionIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      const options = [...updated.lessons[lessonIndex].questions[questionIndex].options]
      options.push('New Option')
      updated.lessons[lessonIndex].questions[questionIndex].options = options
      return updated
    })
  }

  const removeQuestionOption = (lessonIndex, questionIndex, optionIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      const options = [...updated.lessons[lessonIndex].questions[questionIndex].options]
      if (options.length > 1) {
        options.splice(optionIndex, 1)
        updated.lessons[lessonIndex].questions[questionIndex].options = options
        // Adjust correctAnswer if needed
        const correctAnswer = updated.lessons[lessonIndex].questions[questionIndex].correctAnswer
        if (correctAnswer >= options.length) {
          updated.lessons[lessonIndex].questions[questionIndex].correctAnswer = options.length - 1
        }
      }
      return updated
    })
  }

  const updateExerciseField = (lessonIndex, exerciseIndex, field, value) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      updated.lessons[lessonIndex].codingExercises[exerciseIndex] = {
        ...updated.lessons[lessonIndex].codingExercises[exerciseIndex],
        [field]: value
      }
      return updated
    })
  }

  const addQuestion = (lessonIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      const lesson = updated.lessons[lessonIndex]
      if (!lesson.questions) {
        lesson.questions = []
      }
      const uniqueQuestionId = `q${Date.now()}`
      lesson.questions.push({
        id: uniqueQuestionId,
        type: 'multiple-choice',
        question: 'New Question',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctAnswer: 0,
        explanation: 'Explanation for the correct answer'
      })
      return updated
    })
  }

  const deleteQuestion = (lessonIndex, questionIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      updated.lessons[lessonIndex].questions.splice(questionIndex, 1)
      return updated
    })
  }

  const addExercise = (lessonIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      const lesson = updated.lessons[lessonIndex]
      if (!lesson.codingExercises) {
        lesson.codingExercises = []
      }
      const uniqueExerciseId = `ex${Date.now()}`
      lesson.codingExercises.push({
        id: uniqueExerciseId,
        title: 'New Exercise',
        description: 'Exercise description',
        starterCode: '// Your code here',
        language: 'javascript',
        testCases: [],
        solution: '// Solution code'
      })
      return updated
    })
  }

  const deleteExercise = (lessonIndex, exerciseIndex) => {
    setEditedCourse((prev) => {
      const updated = { ...prev }
      updated.lessons[lessonIndex].codingExercises.splice(exerciseIndex, 1)
      return updated
    })
  }

  const handleSave = async () => {
    if (!editedCourse) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await axios.put(`${API_BASE_URL}/api/course/${course.id}`, {
        course: editedCourse
      })

      setSaveMessage({ type: 'success', text: 'Course saved successfully!' })
      if (onCourseUpdated) {
        onCourseUpdated(editedCourse)
      }

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Error saving course:', error)
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.error || 'Error saving course. Please try again.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!editedCourse) {
    return <div>Loading...</div>
  }

  return (
    <div className="admin-viewer">
      <div className="admin-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Courses
        </button>
        <div className="admin-actions">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="save-btn"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          {saveMessage && (
            <div className={`save-message ${saveMessage.type}`}>
              {saveMessage.text}
            </div>
          )}
        </div>
      </div>

      <div className="admin-content">
        {/* Course-level editing */}
        <div className="admin-section">
          <h2>Course Information</h2>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={editedCourse.title || ''}
              onChange={(e) => updateCourseField('title', e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editedCourse.description || ''}
              onChange={(e) => updateCourseField('description', e.target.value)}
              className="form-textarea"
              rows="3"
            />
          </div>
        </div>

        {/* Lessons editing */}
        <div className="admin-section">
          <h2>Lessons</h2>
          {editedCourse.lessons?.map((lesson, lessonIdx) => {
            const lessonId = lesson.id || `lesson-${lessonIdx}`
            const isExpanded = expandedLessons[lessonId]

            return (
              <div key={lessonId} className="lesson-editor">
                <div className="lesson-header" onClick={() => toggleLesson(lessonId)}>
                  <h3>
                    {isExpanded ? '▼' : '▶'} Lesson {lessonIdx + 1}: {lesson.title || 'Untitled'}
                  </h3>
                </div>

                {isExpanded && (
                  <div className="lesson-content-editor">
                    <div className="form-group">
                      <label>Lesson Title</label>
                      <input
                        type="text"
                        value={lesson.title || ''}
                        onChange={(e) => updateLessonField(lessonIdx, 'title', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Lesson Content (Markdown)</label>
                      <textarea
                        value={lesson.content || ''}
                        onChange={(e) => updateLessonField(lessonIdx, 'content', e.target.value)}
                        className="form-textarea markdown-editor"
                        rows="10"
                      />
                      <div className="markdown-preview">
                        <strong>Preview:</strong>
                        <div
                          className="preview-content"
                          dangerouslySetInnerHTML={{ __html: marked.parse(lesson.content || '') }}
                        />
                      </div>
                    </div>

                    {/* Questions */}
                    <div className="questions-editor">
                      <div className="section-header">
                        <h4>Questions</h4>
                        <button
                          onClick={() => addQuestion(lessonIdx)}
                          className="add-btn"
                        >
                          + Add Question
                        </button>
                      </div>

                      {lesson.questions?.map((q, qIdx) => {
                        const questionKey = `${lessonId}-${q.id || qIdx}`
                        const isQExpanded = expandedQuestions[questionKey]

                        return (
                          <div key={questionKey} className="question-editor">
                            <div
                              className="question-header"
                              onClick={() => toggleQuestion(questionKey)}
                            >
                              <span>{isQExpanded ? '▼' : '▶'} Question {qIdx + 1}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteQuestion(lessonIdx, qIdx)
                                }}
                                className="delete-btn"
                              >
                                Delete
                              </button>
                            </div>

                            {isQExpanded && (
                              <div className="question-content-editor">
                                <div className="form-group">
                                  <label>Question Text</label>
                                  <textarea
                                    value={q.question || ''}
                                    onChange={(e) =>
                                      updateQuestionField(lessonIdx, qIdx, 'question', e.target.value)
                                    }
                                    className="form-textarea"
                                    rows="2"
                                  />
                                </div>

                                <div className="form-group">
                                  <label>Options</label>
                                  {q.options?.map((option, optIdx) => (
                                    <div key={optIdx} className="option-editor">
                                      <input
                                        type="radio"
                                        name={`correct-${questionKey}`}
                                        checked={q.correctAnswer === optIdx}
                                        onChange={() =>
                                          updateQuestionField(lessonIdx, qIdx, 'correctAnswer', optIdx)
                                        }
                                        className="correct-radio"
                                      />
                                      <input
                                        type="text"
                                        value={option}
                                        onChange={(e) =>
                                          updateQuestionOption(lessonIdx, qIdx, optIdx, e.target.value)
                                        }
                                        className="form-input option-input"
                                        placeholder={`Option ${optIdx + 1}`}
                                      />
                                      <button
                                        onClick={() => removeQuestionOption(lessonIdx, qIdx, optIdx)}
                                        className="remove-btn"
                                        disabled={q.options.length <= 1}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addQuestionOption(lessonIdx, qIdx)}
                                    className="add-option-btn"
                                  >
                                    + Add Option
                                  </button>
                                  <small className="help-text">
                                    Select the radio button next to the correct answer
                                  </small>
                                </div>

                                <div className="form-group">
                                  <label>Explanation</label>
                                  <textarea
                                    value={q.explanation || ''}
                                    onChange={(e) =>
                                      updateQuestionField(lessonIdx, qIdx, 'explanation', e.target.value)
                                    }
                                    className="form-textarea"
                                    rows="2"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Coding Exercises */}
                    <div className="exercises-editor">
                      <div className="section-header">
                        <h4>Coding Exercises</h4>
                        <button
                          onClick={() => addExercise(lessonIdx)}
                          className="add-btn"
                        >
                          + Add Exercise
                        </button>
                      </div>

                      {lesson.codingExercises?.map((ex, exIdx) => {
                        const exerciseId = ex.id || `ex-${lessonIdx}-${exIdx}`
                        const isExExpanded = expandedExercises[exerciseId]

                        return (
                          <div key={exerciseId} className="exercise-editor">
                            <div
                              className="exercise-header"
                              onClick={() => toggleExercise(exerciseId)}
                            >
                              <span>{isExExpanded ? '▼' : '▶'} {ex.title || 'Untitled Exercise'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteExercise(lessonIdx, exIdx)
                                }}
                                className="delete-btn"
                              >
                                Delete
                              </button>
                            </div>

                            {isExExpanded && (
                              <div className="exercise-content-editor">
                                <div className="form-group">
                                  <label>Title</label>
                                  <input
                                    type="text"
                                    value={ex.title || ''}
                                    onChange={(e) =>
                                      updateExerciseField(lessonIdx, exIdx, 'title', e.target.value)
                                    }
                                    className="form-input"
                                  />
                                </div>

                                <div className="form-group">
                                  <label>Description</label>
                                  <textarea
                                    value={ex.description || ''}
                                    onChange={(e) =>
                                      updateExerciseField(lessonIdx, exIdx, 'description', e.target.value)
                                    }
                                    className="form-textarea"
                                    rows="3"
                                  />
                                </div>

                                <div className="form-group">
                                  <label>Language</label>
                                  <select
                                    value={ex.language || 'javascript'}
                                    onChange={(e) =>
                                      updateExerciseField(lessonIdx, exIdx, 'language', e.target.value)
                                    }
                                    className="form-select"
                                  >
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                    <option value="c">C</option>
                                    <option value="go">Go</option>
                                    <option value="rust">Rust</option>
                                    <option value="typescript">TypeScript</option>
                                  </select>
                                </div>

                                <div className="form-group">
                                  <label>Starter Code</label>
                                  <Editor
                                    height="200px"
                                    language={ex.language || 'javascript'}
                                    value={ex.starterCode || ''}
                                    onChange={(value) =>
                                      updateExerciseField(lessonIdx, exIdx, 'starterCode', value || '')
                                    }
                                    theme="vs-dark"
                                    options={{
                                      minimap: { enabled: false },
                                      fontSize: 14,
                                      wordWrap: 'on',
                                    }}
                                  />
                                </div>

                                <div className="form-group">
                                  <label>Solution</label>
                                  <Editor
                                    height="200px"
                                    language={ex.language || 'javascript'}
                                    value={ex.solution || ''}
                                    onChange={(value) =>
                                      updateExerciseField(lessonIdx, exIdx, 'solution', value || '')
                                    }
                                    theme="vs-dark"
                                    options={{
                                      minimap: { enabled: false },
                                      fontSize: 14,
                                      wordWrap: 'on',
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AdminViewer
