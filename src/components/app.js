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
  // const [downloadPercentage, setDownloadPercentage] = useState(0)

  const dummyDownloads = [
    { name: 'Awesome Song One', percentage: 42 },
    { name: "I'm a great song", percentage: 28 },
    { name: 'Some sad song', percentage: null },
    { name: 'I really like this song', percentage: null },
    { name: 'Yooooo', percentage: null }
  ]

  const [downloads, setDownloads] = useState([])

  // Refs
  const buttonRef = useRef()
  const inputRef = useRef()

  const showDisplay = message => {
    setDisplayMessage(message)
    setTimeout(() => {
      setDisplayMessage('')
    }, 2000)
  }

  const startDownload = e => {
    e.preventDefault()

    if (url !== '') {
      ipcRenderer.send('download', { url, format })
    }

    setUrl('')
    showDisplay('Adding video to queue')
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

    ipcRenderer.on('downloads', (event, downloads) => {
      setDownloads(downloads)
    })

    ipcRenderer.on('download:error', (event, error) => {
      showDisplay(error.message)
    })
  }, [])

  return (
    <div className="app-wrapper">
      <TitleBar />
      <div className="padding">
        {displayMessage && (
          <div className="display">
            <p>{displayMessage}</p>
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
          <p className="no-downloads">No downloads to show</p>
        ) : (
          <Fragment>
            <div className="downloads-header">
              <h1>Downloads</h1>
              <button>Clear completed</button>
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
