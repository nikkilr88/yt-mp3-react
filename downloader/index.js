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

    this._downloads = {}

    // If you want to only allow one download at a time
    // https://stackoverflow.com/questions/57362319/how-to-download-files-one-by-one-in-node-js
    this._downloadQueue = async.queue((task, callback) => {
      if (task.downloadFormat === 'mp3') {
        this.downloadMP3({ fileData: task.fileData, url: task.url, callback })
      } else {
        this.downloadMP4({ fileData: task.fileData, url: task.url, callback })
      }
    }, 2)

    // Create reference to the original .on() method
    this.onOriginal = this.on
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

    @param {{extension: string, url: string}}
    @returns {{videoTitle: string, path: string}} file data with video title and path where file is saved
    
  =============================================== */

  async generateFileData({ extension, url }) {
    const videoInfo = await ytdl.getBasicInfo(url)

    // FIXME: Once threw an error trying to read player_response. Can't replicate error.
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)

    // TODO: Refactor this to return a promise
    return {
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${extension}`
    }
  }

  /* ===============================================

    !: Emit progress data
    This catches progress events emitted from ytdl-core and emits own progress event with percentage value

  =============================================== */

  handleProgress(_, downloaded, total, task) {
    const percentage = (downloaded / total) * 100
    this._downloads[task.name].percentage = percentage

    console.log(percentage)
    // TODO: Handle all of this in React. Only send task name and percentage. Do not keep track of downloads in this class
    this.emit('downloads', Object.values(this._downloads))
  }

  /* ===============================================
  
    !: Limit Event Listeners
    Every time the user hits the 'download' button, a new event listener is added. We add this method to prevent more than one listener to be added for each event.

  =============================================== */

  limitListeners() {
    const events = ['downloads', 'error', 'finish']

    // Override the .on() method and return 'this' if there is already one listener for the event

    for (let event of events) {
      this.on = this.listenerCount(event) === 0 ? this.onOriginal : () => this
    }
  }

  /* ===============================================
  
    !: Init download
    If there are any errors fetching video data or if the URL is invalid, we return an error.

    @param {{downloadFormat: string, url: string}} Format to download file as and the URL to the video to be downloaded

  =============================================== */

  async initDownload({ downloadFormat, url }) {
    this.limitListeners()

    // Check if URL is valid. If it's not, early return with an error
    const isValid = await this.validateURL(url)

    if (!isValid) {
      return this.emit('error', new Error('Not a valid URL'))
    }

    let fileData

    try {
      fileData = await this.generateFileData({ extension: downloadFormat, url })
    } catch (error) {
      return this.emit('error', new Error("Can't process video"))
    }

    this._downloads[fileData.videoTitle] = {
      name: fileData.videoTitle
    }

    this._downloadQueue.push({ fileData, downloadFormat, url })
  }

  /* ===============================================
  
    !: Download video as MP3
    Grab ytdl stream and pass to ffmpeg to be converted. Save converted file to output folder.

  =============================================== */

  downloadMP3({ fileData, url, callback }) {
    // TODO: Add download quality options [normal, high]
    const stream = ytdl(url, {
      quality: 'highestaudio'
    })

    stream.on(
      'progress',
      throttle(this._throttleValue, (...rest) =>
        this.handleProgress(...rest, { name: fileData.videoTitle })
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
        callback()
      })
      .on('error', () => this.emit('error', new Error('Something went wrong')))
  }

  /* ===============================================
  
    !: Download video as MP4
    Download video using ytdl and save to output folder.

  =============================================== */

  downloadMP4 = ({ fileData, url }) => {
    // TODO: Fix mp4 video quality
    // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js

    ytdl(url, {
      quality: 'highest'
    })
      .on('error', () => this.emit('error', new Error('Something went wrong')))
      .on(
        'progress',
        throttle(this._throttleValue, (...rest) =>
          this.handleProgress(...rest, { name: fileData.videoTitle })
        )
      )
      .pipe(fs.createWriteStream(fileData.path))
      .on('finish', () => this.emit('finish', fileData))
  }
}

module.exports = Downloader
