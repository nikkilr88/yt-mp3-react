const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { removeFile } = require('./utils')
const Downloader = require('./downloader')

// https://stackoverflow.com/questions/44880926/how-can-i-download-file-inside-app-folder-after-packaging

// https://stackoverflow.com/questions/38361996/how-can-i-bundle-a-precompiled-binary-with-electron

// !: DOWNLOADER SHIZZ =================
// Set up tmp downloads output path and downloader
const isDev = process.env.NODE_ENV === 'DEVELOP'

const downloader = new Downloader({
  outputPath: app.getPath('downloads')
})

// !: WINDOW SHIZZ =================

let win

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 280,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.loadURL(
    isDev
      ? 'http://localhost:1234'
      : `file://${path.join(__dirname, './dist/index.html')}`
  )

  win.setMenuBarVisibility(false)
  win.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// !: DOWNLOAD SHIZZ =================

ipcMain.on('download', async (event, { url, format }) => {
  // Catch and handle any errors that come back from the downloader
  downloader.on('error', error => {
    event.reply('download:error', error)
  })

  // Get download progress
  downloader.on('progress', percentage => {
    event.reply('download:progress', percentage)
  })

  downloader.on('downloads', downloads => {
    event.reply('downloads', downloads)
  })

  // Handle data once download is finished
  downloader.on('finish', async function handler(data) {
    event.reply('download:success')
    console.log('download complete! ', data.videoTitle)
  })

  // Download file to tmp folder
  downloader.initDownload({ downloadFormat: format, url })
})
