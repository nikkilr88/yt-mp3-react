const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { removeFile } = require('./utils')
const Downloader = require('./downloader')

const downloader = new Downloader({
  outputPath: path.join(__dirname, 'downloads')
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

// !: IPC SHIZZ =================

ipcMain.on('ping', (event, data) => {
  event.sender.send('pong', 'pong')
})

ipcMain.on('download', async (event, link) => {
  // Get YouTube video id from URL
  const id = link.split('?v=')[1]

  // Convert and download file locally, return file data
  const fileData = await downloader.downloadMP3({ id, event })

  // Read file and open save dialog.
  // We do this so the user can choose the save location and set the filename all at once.
  const savePath = await dialog.showSaveDialog({
    defaultPath: fileData.videoTitle,
    filters: [
      {
        name: 'mp3',
        extensions: ['mp3']
      }
    ]
  })

  // If the user closes the dialog without saving, we remove the mp3 file from our downloads folder
  if (savePath.filePath === '') {
    return removeFile(fileData.file)
  }

  // Read the mp3 file!
  const mp3 = fs.readFileSync(fileData.file)

  // Save the file!
  fs.writeFile(savePath.filePath, mp3, error => {
    if (error) {
      console.log(error)
    }

    // Once the file has been saved, we remove it from our downloads folder
    removeFile(fileData.file)
  })
})
