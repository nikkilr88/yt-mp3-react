import React, { useState, useEffect, useRef } from 'react'

// Electron
const { ipcRenderer } = window.require('electron')

// Components
import TitleBar from './title-bar/title-bar.component.jsx'

// Styles
import './app.css'

const App = () => {
  // State
  const [url, setUrl] = useState('')
  const [downloadPercentage, setDownloadPercentage] = useState(0)
  const [displayMessage, setDisplayMessage] = useState(
    'Paste a video link below'
  )

  // Refs
  const buttonRef = useRef()
  const inputRef = useRef()

  const startDownload = e => {
    e.preventDefault()

    if (url !== '') {
      ipcRenderer.send('download', url)
      buttonRef.current.disabled = true
    }
  }

  useEffect(() => {
    inputRef.current.focus()

    ipcRenderer.on('download:progress', (event, percentage) => {
      setDownloadPercentage(percentage)
      setDisplayMessage(`Converting: ${Math.round(percentage)}% complete...`)
    })

    ipcRenderer.on('download:success', () => {
      setUrl('')
      setDownloadPercentage(0)
      setDisplayMessage('Done!')
      buttonRef.current.disabled = false

      setTimeout(() => {
        setDisplayMessage('Paste a video link below ')
      }, 1000)
    })

    ipcRenderer.on('download:error', () => {
      setDisplayMessage('Please check the video URL and try again.')
      buttonRef.current.disabled = false
    })
  }, [])

  return (
    <div className="app-wrapper">
      <TitleBar />
      <div className="padding">
        <div className="display">
          <p>{displayMessage}</p>
        </div>

        <form className="form">
          <input
            type="text"
            value={url}
            ref={inputRef}
            className="input"
            onChange={e => setUrl(e.target.value)}
          />
          <button
            ref={buttonRef}
            onClick={startDownload}
            className="download-btn"
          >
            {downloadPercentage > 0 ? '...' : 'Convert'}
          </button>
        </form>
      </div>

      <div className="progress-bar-wrapper">
        <div
          className="progress-bar"
          style={{ width: `${downloadPercentage}%` }}
        ></div>
      </div>
    </div>
  )
}

export default App
