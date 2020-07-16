const fs = require('fs')
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
  }

  /* ===============================================

    !Validate URL
    Check if the URL the user entered it valid. 

    @param {string} url
    @returns {boolean} 

  =============================================== */

  validateURL = url => {
    let isValid

    try {
      isValid = ytdl.validateURL(url)
    } catch (error) {
      return this.handleError(error)
    }

    // Throw error if the video URL is invalid
    if (!isValid) {
      // We use nextTick so the .on() calls can be async
      process.nextTick(() => {
        this.emit('error', new Error('Invalid URL'))
        this.removeAllListeners()
      })
    }

    return isValid
  }

  /* ===============================================

    !: Generate file data
    This returns an object with the video title and the path where it will be saved.

    @param {{extension: string, url: string}}
    @returns {{videoTitle: string, path: string}} file data with video title and path where file is saved
    
  =============================================== */

  generateFileData = async ({ extension, url }) => {
    let videoInfo

    try {
      videoInfo = await ytdl.getBasicInfo(url)
    } catch (error) {
      this.handleError('Oops! Something went wrong.')
    }

    // FIXME: Once threw an error trying to read player_response. Can't replicate error.
    const videoTitle = sanitize(videoInfo?.player_response?.videoDetails.title)

    // TODO: Refactor this to return a promise
    return {
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${extension}`,
    }
  }

  /* ===============================================

    !: Emit error
    This catches error events emitted from ytdl-core and fluent-ffmpeg and emits own error event

  =============================================== */

  handleError = () => {
    this.emit('error', new Error("Can't process video."))
    this.removeAllListeners()
  }

  /* ===============================================

    !: Emit progress data
    This catches progress events emitted from ytdl-core and emits own progress event with percentage value

  =============================================== */

  handleProgress = (_, downloaded, total) => {
    const percentage = (downloaded / total) * 100
    this.emit('progress', percentage)
  }

  /* ===============================================
  
    !: Send file data when download / convert is complete
    This catches finish / end events emitted from ytdl-core and fluent-ffmpeg and emits file data with extension, file path and video title.

    @param {{fileData: object, extension: string}}

  =============================================== */

  handleFinish = ({ fileData, extension }) => {
    setTimeout(() => {
      this.emit('finish', {
        extension,
        file: fileData.path,
        videoTitle: fileData.videoTitle,
      })
      this.removeAllListeners()
    }, this._throttleValue)
  }

  /* ===============================================
  
    !: Init download
    If there are any errors fetching video data or if the URL is invalid, we return an error.

    @param {{downloadFormat: string, url: string}} Format to download file as and the URL to the video to be downloaded

  =============================================== */

  initDownload = async ({ downloadFormat, url }) => {
    if (!this.validateURL(url)) return

    const fileData = await this.generateFileData({ extension: 'mp3', url })

    if (downloadFormat === 'mp3') {
      this.downloadMP3({ fileData, url })
    } else {
      this.downloadMP4({ fileData, url })
    }
  }

  /* ===============================================
  
    !: Download video as MP3
    Grab ytdl stream and pass to ffmpeg to be converted. Save converted file to output folder.

  =============================================== */

  downloadMP3 = ({ fileData, url }) => {
    // ?: Add download quality options [normal, high]
    const stream = ytdl(url, {
      quality: 'highestaudio',
    })

    stream.on('progress', throttle(this._throttleValue, this.handleProgress))

    const proc = new ffmpeg({ source: stream }).setFfmpegPath(ffmpegPath)

    proc
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .save(fileData.path)
      .on('end', () => this.handleFinish({ fileData, extension: 'mp3' }))
      .on('error', this.handleError)
  }

  /* ===============================================
  
    !: Download video as MP4
    Download video using ytdl and save to output folder.

  =============================================== */

  downloadMP4 = ({ fileData, url }) => {
    // ?: Add mp4 video quality options
    // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js

    ytdl(url, {
      quality: 'highest',
    })
      .on('error', this.handleError)
      .on('progress', throttle(this._throttleValue, this.handleProgress))
      .pipe(fs.createWriteStream(fileData.path))
      .on('finish', () => this.handleFinish({ fileData, extension: 'mp4' }))
  }
}

module.exports = Downloader
