import React, { useState, useEffect, useRef } from 'react'

// Electron
const { remote, ipcRenderer } = window.require('electron')
const { Menu, MenuItem } = remote

// Components
import TitleBar from './title-bar/title-bar.component.jsx'
import ProgressBar from './progress-bar/progress-bar.component.jsx'

// Styles
import './app.css'

const App = () => {
  // State
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp3:high')
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
      ipcRenderer.send('download', { url, formatData: format })
      buttonRef.current.disabled = true
    }
  }

  useEffect(() => {
    const menu = new Menu()

    const menuItem = new MenuItem({
      label: 'Paste URL',
      role: 'paste'
    })

    menu.append(menuItem)

    inputRef.current.addEventListener(
      'contextmenu',
      event => {
        event.preventDefault()
        menu.popup(remote.getCurrentWindow())
      },
      false
    )
  }, [])

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

    ipcRenderer.on('download:error', (event, error) => {
      setDisplayMessage(error.message)
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
            onChange={event => {
              console.log(event.target.value)
              setFormat(event.target.value)
            }}
          >
            <option value="mp3:high">mp3 (HQ)</option>
            <option value="mp3:low">mp3 (LQ)</option>
            <option value="mp4:low">mp4 (LQ)</option>
          </select>
          <button
            ref={buttonRef}
            onClick={startDownload}
            className="download-btn"
          >
            {downloadPercentage > 0 ? '...' : 'Download'}
          </button>
        </form>

        <ProgressBar percentage={downloadPercentage} />
      </div>
    </div>
  )
}

export default App
