import React from 'react'
const { remote } = window.require('electron')

// Styles
import './title-bar.styles.css'

const TitleBar = () => {
  return (
    <header className="title-bar">
      <div className="controls">
        <button
          className="close"
          onClick={() => {
            remote.getCurrentWindow().close()
          }}
        ></button>
        <button className="min"></button>
        <button className="max"></button>
      </div>
      <p>YouTube to MP3</p>
    </header>
  )
}

export default TitleBar
