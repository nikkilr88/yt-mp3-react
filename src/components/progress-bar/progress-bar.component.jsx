import React from 'react'

// Styles
import './progress-bar.styles.css'

const ProgressBar = ({ percentage }) => {
  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
    </div>
  )
}

export default ProgressBar
