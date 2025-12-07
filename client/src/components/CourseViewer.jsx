import { useState } from 'react'
import { marked } from 'marked'
import Editor from '@monaco-editor/react'
import axios from 'axios'
import './CourseViewer.css'

function CourseViewer({ course, onBack, onEdit }) {
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [showExplanations, setShowExplanations] = useState({})
  const [codeSolutions, setCodeSolutions] = useState({})
  const [codeValues, setCodeValues] = useState({})

  const handleAnswerSelect = (questionId, answerIndex) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerIndex }))
  }

  const checkAnswer = (questionId, correctAnswer) => {
    setShowExplanations((prev) => ({ ...prev, [questionId]: true }))
  }

  const toggleCodeSolution = (exerciseId) => {
    setCodeSolutions((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }))
  }

  const handleCodeChange = (exerciseId, value) => {
    setCodeValues((prev) => ({ ...prev, [exerciseId]: value }))
  }

  const handleExport = async () => {
    try {
      const response = await axios.get(`/api/export/${course.id}`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${course.title.replace(/\s+/g, '-')}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error exporting course:', error)
      alert('Error exporting course. Please try again.')
    }
  }

  return (
    <div className="course-viewer">
      <div className="viewer-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Courses
        </button>
        <div className="viewer-actions">
          {onEdit && (
            <button onClick={() => onEdit(course.id)} className="edit-btn">
              Edit Course
            </button>
          )}
          <button onClick={handleExport} className="export-btn">
            Export Course
          </button>
        </div>
      </div>

      <div className="course-header">
        <h1>{course.title}</h1>
        <p className="course-description">{course.description}</p>
      </div>

      <div className="lessons">
        {course.lessons?.map((lesson) => (
          <div key={lesson.id} className="lesson-card">
            <h2>{lesson.title}</h2>
            <div
              className="lesson-content"
              dangerouslySetInnerHTML={{ __html: marked.parse(lesson.content) }}
            />

            {lesson.questions && lesson.questions.length > 0 && (
              <div className="questions-section">
                <h3>Questions</h3>
                {lesson.questions.map((q, qIdx) => {
                  // Create a unique key combining lesson ID and question ID/index
                  const uniqueQuestionId = `${lesson.id}-${q.id || qIdx}`
                  return (
                    <div key={uniqueQuestionId} className="question">
                      <h4>{q.question}</h4>
                      <div className="options">
                        {q.options.map((option, idx) => (
                          <div
                            key={idx}
                            className={`option ${
                              selectedAnswers[uniqueQuestionId] === idx ? 'selected' : ''
                            } ${
                              showExplanations[uniqueQuestionId] && idx === q.correctAnswer
                                ? 'correct'
                                : ''
                            } ${
                              showExplanations[uniqueQuestionId] &&
                              selectedAnswers[uniqueQuestionId] === idx &&
                              idx !== q.correctAnswer
                                ? 'incorrect'
                                : ''
                            }`}
                            onClick={() => handleAnswerSelect(uniqueQuestionId, idx)}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                      {selectedAnswers[uniqueQuestionId] !== undefined && (
                        <button
                          className="check-btn"
                          onClick={() => checkAnswer(uniqueQuestionId, q.correctAnswer)}
                        >
                          Check Answer
                        </button>
                      )}
                      {showExplanations[uniqueQuestionId] && (
                        <div className="explanation">
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {lesson.codingExercises && lesson.codingExercises.length > 0 && (
              <div className="coding-section">
                <h3>Coding Exercises</h3>
                {lesson.codingExercises.map((ex) => (
                  <div key={ex.id} className="coding-exercise">
                    <h4>{ex.title}</h4>
                    <p>{ex.description}</p>
                    {ex.testCases && ex.testCases.length > 0 && (
                      <div className="test-cases">
                        <strong>Test Cases:</strong>
                        <ul>
                          {ex.testCases.map((testCase, idx) => (
                            <li key={idx}>
                              Input: <code>{testCase.input}</code> → Expected:{' '}
                              <code>{testCase.expectedOutput}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="editor-container">
                      <Editor
                        height="400px"
                        language={ex.language || 'javascript'}
                        value={codeValues[ex.id] || ex.starterCode}
                        onChange={(value) => handleCodeChange(ex.id, value)}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          wordWrap: 'on',
                        }}
                      />
                    </div>
                    <button
                      className="solution-btn"
                      onClick={() => toggleCodeSolution(ex.id)}
                    >
                      {codeSolutions[ex.id] ? 'Hide Solution' : 'Show Solution'}
                    </button>
                    {codeSolutions[ex.id] && (
                      <div className="solution">
                        <strong>Solution:</strong>
                        <pre>
                          <code>{ex.solution}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CourseViewer
