const fs = require('fs')
const async = require('async')
const EventEmitter = require('events')
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg')
const sanitize = require('sanitize-filename')
const { throttle } = require('throttle-debounce')
let ffmpegPath = require('ffmpeg-static')

ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')

class Downloader extends EventEmitter {
  constructor({ outputPath }) {
    super()

    this._outputPath = outputPath
    this._throttleValue = 100

    this.downloads = {}

    // Check format and call corresponding method to download file
    // We pass callback to the download method so we can limit how many downloads start at one time. We set the download limit as the second argument to async.queue
    this._downloadQueue = async.queue((task, next) => {
      const downloadData = { fileData: task.fileData, url: task.url, next }

      if (task.format === 'mp3') {
        this.downloadMP3(downloadData)
      } else {
        this.downloadMP4(downloadData)
      }
    }, 2)

    // This runs after all of the tasks in the queue are complete
    this._downloadQueue.drain(() => {
      console.log('All tasks complete!')
    })

    // Create reference to the original .on() method inherited from event emitter
    this._onOriginal = this.on
  }

  /* ===============================================

    !Validate URL
    Check if the URL the user entered it valid. 

    @param {string} url
    @returns {boolean} 

  =============================================== */

  async validateURL(url) {
    const isValid = await ytdl.validateURL(url)
    return isValid
  }

  /* ===============================================

    !: Generate file data
    This returns an object with the video title and the path where it will be saved.

    @param {{format: string, url: string}}
    @returns {{videoTitle: string, path: string}} file data with video title and path where file is saved
    
  =============================================== */

  async generateFileData({ format, url }) {
    const videoInfo = await ytdl.getBasicInfo(url)

    // Sanitize the filename and remove special characters. If we don't do this, we won't be able to save the file.
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)

    // TODO: Refactor this to return a promise
    return {
      format,
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${format}`
    }
  }

  /* ===============================================

    !: Emit progress data
    This catches progress events emitted from ytdl-core and emits own progress event with percentage value

  =============================================== */

  _handleProgress(_, downloaded, total, task) {
    // Calculate percentage
    // ? Round value here
    const percentage = (downloaded / total) * 100

    // TODO: Emit one object with name, format and percentage
    // Update downloads task object with percentage
    this.downloads[`${task.name}_${task.format}`].percentage = percentage

    // Emit an array of all the downloads
    this.emit('downloads', Object.values(this.downloads))
  }

  /* ===============================================
  
    !: Limit Event Listeners
    Every time the user hits the 'download' button, a new event listener is added. We add this method to prevent more than one listener to be added for each event.

  =============================================== */

  _limitListeners() {
    // A list of the events we emit
    const events = ['downloads', 'error', 'finish']

    // Override the .on() method and return 'this' if there is already one listener for the event
    for (let event of events) {
      this.on = this.listenerCount(event) === 0 ? this._onOriginal : () => this
    }
  }

  /* ===============================================
  
    !: Clear completed downloads
    Loop through the downloads object and remove any downloads that have a percentage of 100

  =============================================== */

  clearCompletedDownloads = () => {
    for (let download in this.downloads) {
      if (this.downloads[download].percentage === 100) {
        delete this.downloads[download]
      }
    }
  }

  /* ===============================================
  
    !: Init download
    If there are any errors fetching video data or if the URL is invalid, we return an error.

    @param {{downloadFormat: string, url: string}} Format to download file as and the URL to the video to be downloaded

  =============================================== */

  async initDownload({ format, url }) {
    this._limitListeners()

    // Check if URL is valid. If it's not, return an error
    const isValid = await this.validateURL(url)

    if (!isValid) {
      return this.emit('error', new Error('Not a valid URL'))
    }

    let fileData

    // Try to generate file data. If we get back an error, we return and emit the error
    try {
      fileData = await this.generateFileData({ format, url })
    } catch (error) {
      return this.emit('error', new Error("Can't process video"))
    }

    // If the video title is already in the downloads object, we return an error
    if (`${fileData.videoTitle}_${format}` in this.downloads) {
      return this.emit('error', new Error('Video already in queue'))
    }

    // Add video title to the downloads object. We will update this object with download progress later.
    // TODO: Use URL as object property
    this.downloads[`${fileData.videoTitle}_${format}`] = {
      format,
      name: fileData.videoTitle
    }

    // Push the download into the queue
    this._downloadQueue.push({ fileData, format, url })
  }

  /* ===============================================
  
    !: Download video as MP3
    Grab ytdl stream and pass to ffmpeg to be converted. Save converted file to output folder.

  =============================================== */

  downloadMP3({ fileData, url, next }) {
    const stream = ytdl(url, {
      quality: 'highestaudio'
    })

    stream.on(
      'progress',
      throttle(this._throttleValue, (...args) =>
        this._handleProgress(...args, {
          name: fileData.videoTitle,
          format: fileData.format
        })
      )
    )

    const proc = new ffmpeg({ source: stream }).setFfmpegPath(ffmpegPath)

    proc
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .save(fileData.path)
      .on('end', () => {
        this.emit('finish', fileData)
        next()
      })
      .on('error', () => this.emit('error', new Error('Something went wrong')))
  }

  /* ===============================================
  
    !: Download video as MP4
    Download video using ytdl and save to output folder.

  =============================================== */

  downloadMP4 = ({ fileData, url, next }) => {
    // ? Improve video quality
    // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js

    ytdl(url, {
      quality: 'highest'
    })
      .on('error', () => this.emit('error', new Error('Something went wrong')))
      .on(
        'progress',
        throttle(this._throttleValue, (...rest) =>
          this._handleProgress(...rest, {
            name: fileData.videoTitle,
            format: fileData.format
          })
        )
      )
      .pipe(fs.createWriteStream(fileData.path))
      .on('finish', () => {
        this.emit('finish', fileData)
        next()
      })
  }
}

module.exports = Downloader
