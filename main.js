const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { removeFile } = require('./utils')
const Downloader = require('./downloader')

// https://stackoverflow.com/questions/44880926/how-can-i-download-file-inside-app-folder-after-packaging

// https://stackoverflow.com/questions/38361996/how-can-i-bundle-a-precompiled-binary-with-electron

const downloader = new Downloader({
  outputPath: path.join(__dirname, 'tmp')
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

  const isDev = process.env.NODE_ENV === 'DEVELOP'

  win.loadURL(
    isDev
      ? 'http://localhost:1234'
      : `file://${path.join(__dirname, './dist/index.html')}`
  )

  win.setMenuBarVisibility(false)

  // win.webContents.openDevTools()
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

// !: IPC SHIZZ =================

ipcMain.on('download', async (event, url) => {
  // Get YouTube video id from URL
  const id = url.split('?v=')[1]

  // Convert and download file to tmp folder, return file data
  const fileData = await downloader.downloadMP4({ videoId: id, event })

  console.log({ fileData })

  // Open save dialog and let user name file and choose where to save it
  const savePath = await dialog.showSaveDialog({
    defaultPath: fileData.videoTitle,
    filters: [
      {
        name: fileData.extension,
        extensions: [fileData.extension]
      }
    ]
  })

  // If the user closes the save dialog without saving, we remove the mp3 file from our tmp folder
  if (savePath.filePath === '') {
    return removeFile(fileData.file)
  }

  // Read the mp3 file
  const mp3 = fs.readFileSync(fileData.file)

  // Save the file to the path the user chose from the save dialog
  fs.writeFile(savePath.filePath, mp3, error => {
    if (error) {
      console.log(error)
    }

    // Once the file has been saved, we remove it from our tmp folder
    removeFile(fileData.file)
  })
})
