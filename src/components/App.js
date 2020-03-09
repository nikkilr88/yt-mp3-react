import React, { useState, useEffect } from 'react'

// Components
import TitleBar from './title-bar/title-bar.component.jsx'

// Styles
import './App.css'

const App = () => {
  const [displayMessage, setDisplayMessage] = useState(
    'Paste a video link below'
  )

  // useEffect(() => {
  //   window.ipcRenderer.send('ping')
  //   window.ipcRenderer.on('pong', (event, message) => {
  //     console.log(message)
  //   })
  // }, [])

  return (
    <div className="app-wrapper">
      <TitleBar />
      <div className="padding">
        <div className="display">
          <p>{displayMessage}</p>
        </div>
        <form>
          <input className="input" type="text" placeholder="video link" />
          <button className="download-btn">Convert</button>
        </form>
      </div>
    </div>
  )
}

export default App
