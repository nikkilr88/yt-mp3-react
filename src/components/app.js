import React, { useState, useEffect, useRef, Fragment } from 'react'

// Electron
const { remote, ipcRenderer } = window.require('electron')
const { Menu, MenuItem } = remote

// Components
import TitleBar from './title-bar/title-bar.component.jsx'
import ProgressBar from './progress-bar/progress-bar.component.jsx'

// Assets
import DownloadIcon from '../assets/download-icon.png'

// Styles
import './app.css'

const App = () => {
  // State
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp3')
  const [displayMessage, setDisplayMessage] = useState('')

  const dummyDownloads = [
    { name: 'Awesome Song One', percentage: 42 },
    { name: "I'm a great song", percentage: 100 },
    { name: 'Some sad song', percentage: null },
    { name: 'I really like this song', percentage: null },
    { name: 'Yooooo', percentage: null }
  ]

  const [downloads, setDownloads] = useState([])

  // Refs
  const buttonRef = useRef()
  const inputRef = useRef()
  const timeoutRef = useRef()

  // !: Show the display popup and hide it after 2 seconds
  const showDisplay = ({ message, type }) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setDisplayMessage({ message, type })

    timeoutRef.current = setTimeout(() => {
      setDisplayMessage('')
    }, 2000)
  }

  // !: Clear all of the completed downloads from the downloads array
  const clearCompletedDownloads = () => {
    ipcRenderer.send('clearCompleted')

    const activeDownloads = downloads.filter(
      download => download.percentage !== 100
    )

    setDownloads(activeDownloads)
  }

  // !: Send request to start the download if the input isn't empty
  const startDownload = e => {
    e.preventDefault()

    if (url !== '') {
      ipcRenderer.send('download', { url, format })
    }

    setUrl('')
    showDisplay({ message: 'Adding video to queue', type: 'INFO' })
  }

  // !: Create the context (right click) menu
  // The only option we add is 'paste'
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

  // !: Ipc Renderer shiz to communicate with main.js
  useEffect(() => {
    inputRef.current.focus()

    ipcRenderer.on('downloads', (event, downloads) => {
      setDownloads(downloads)
    })

    ipcRenderer.on('download:error', (event, error) => {
      showDisplay({ message: error.message, type: 'ERROR' })
    })
  }, [])

  return (
    <div className="app-wrapper">
      <TitleBar />
      <div className="padding">
        {displayMessage && (
          <div
            className="display"
            style={{
              background:
                displayMessage.type === 'ERROR' ? '#c0392b' : '#19222a'
            }}
          >
            <p>{displayMessage.message}</p>
          </div>
        )}
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
            <img src={DownloadIcon} alt="download icon" /> Download
          </button>
        </form>
        {!downloads.length ? (
          <p className="no-downloads"> No downloads</p>
        ) : (
          <Fragment>
            <div className="downloads-header">
              <h1>Downloads</h1>
              <button onClick={clearCompletedDownloads}>Clear completed</button>
            </div>
            <section className="downloads">
              {downloads.map(download => (
                <div className="download-item">
                  <span>{download.name}</span>{' '}
                  <span>
                    {typeof download.percentage === 'number'
                      ? `${Math.round(download.percentage)}%`
                      : 'waiting'}
                  </span>
                </div>
              ))}
            </section>
          </Fragment>
        )}
      </div>
    </div>
  )
}

export default App
