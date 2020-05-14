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

const outputPath = isDev
  ? path.join(__dirname, 'tmp')
  : path.join(app.getPath('userData'), 'tmp')

// Create tmp directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath)
}

// Empty out this directory on app start.
// If the app is closed while downloading a file, the file is not removed
// ? How to do this before close
const files = fs.readdirSync(outputPath)

for (let file of files) {
  removeFile(path.join(outputPath, file))
}

const downloader = new Downloader({
  outputPath,
})

// !: WINDOW SHIZZ =================

let win

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 290,
    icon: path.join(__dirname, 'icon.ico'),
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    },
  })

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

// !: DOWNLOAD SHIZZ =================

ipcMain.on('download', async (event, { url, format }) => {
  // Download file to tmp folder
  downloader.initDownload({ downloadFormat: format, url })

  // Catch and handle any errors that come back from the downloader
  downloader.on('error', error => {
    event.reply('download:error', error)
  })

  // Get download progress
  downloader.on('progress', percentage => {
    event.reply('download:progress', percentage)
  })

  // Handle data once download is finished
  downloader.on('finish', async data => {
    event.reply('download:success')

    // Open save dialog and let user name file and choose where to save it
    const savePath = await dialog.showSaveDialog({
      defaultPath: data.videoTitle,
      filters: [
        {
          name: `${data.extension.toUpperCase()}`,
          extensions: [data.extension],
        },
      ],
    })

    // If the user closes the save dialog without saving, we remove the file from our tmp folder
    if (savePath.filePath === '') {
      return removeFile(data.file)
    }

    // Read the mp3 file
    const tmpFile = fs.readFileSync(data.file)

    // Save the file to the path the user chose from the save dialog
    fs.writeFile(savePath.filePath, tmpFile, error => {
      if (error) {
        console.log(error)
      }

      // Once the file has been saved, we remove it from our tmp folder
      removeFile(data.file)
    })
  })
})
