import React, { useState, useEffect, useRef } from 'react'

// Electron
const { ipcRenderer } = window.require('electron')

// Components
import TitleBar from './title-bar/title-bar.component.jsx'
import ProgressBar from './progress-bar/progress-bar.component.jsx'

// Styles
import './app.css'

const App = () => {
  // State
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp3')
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
      ipcRenderer.send('download', { url, format })
      buttonRef.current.disabled = true
    }
  }

  useEffect(() => {
    inputRef.current.focus()

    ipcRenderer.on('download:progress', (event, percentage) => {
      setDownloadPercentage(percentage)
      setDisplayMessage(`Working: ${Math.round(percentage)}% complete...`)
    })

    ipcRenderer.on('download:success', () => {
      setUrl('')
      setDownloadPercentage(0)
      setDisplayMessage('Done!')
      buttonRef.current.disabled = false

      setTimeout(() => {
        setDisplayMessage('Paste a video link below ')
      }, 2000)
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
          <select
            onChange={e => {
              setFormat(e.target.value)
            }}
          >
            <option>mp3</option>
            <option>mp4</option>
          </select>
          <button
            ref={buttonRef}
            onClick={startDownload}
            className="download-btn"
          >
            {downloadPercentage > 0 ? '...' : 'Convert'}
          </button>
        </form>

        <ProgressBar percentage={downloadPercentage} />
      </div>
    </div>
  )
}

export default App
