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

  // !: Check to see if the video URL is valid
  validateURL = url => {
    const isValid = ytdl.validateURL(url)

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

  // !: Generate file data
  // This returns an object with the video title and the path where it will be saved.
  generateFileData = async ({ extension, url }) => {
    const videoInfo = await ytdl.getBasicInfo(url)
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)

    // TODO: Refactor this to return a promise
    return {
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${extension}`
    }
  }

  // !: Send error
  handleError = () => {
    this.emit('error', new Error("Can't process video."))
    this.removeAllListeners()
  }

  // !: Send download / convert progress information
  handleProgress = (_, downloaded, total) => {
    const percentage = (downloaded / total) * 100
    this.emit('progress', percentage)
  }

  // !: Send file data when download / convert is complete
  handleFinish = ({ fileData, extension }) => {
    setTimeout(() => {
      this.emit('finish', {
        extension,
        file: fileData.path,
        videoTitle: fileData.videoTitle
      })
      this.removeAllListeners()
    }, this._throttleValue)
  }

  // !: Init download
  // If there are any errors fetching video data or if the URL is invalid, we return an error
  initDownload = async ({ downloadFormat, url }) => {
    if (!this.validateURL(url)) return

    let fileData
    // const url = `http://www.youtube.com/watch?v=${videoId}`

    try {
      fileData = await this.generateFileData({ extension: 'mp3', url })
    } catch (error) {
      // console.log(error)
      return this.handleError()
    }

    if (downloadFormat === 'mp3') {
      this.downloadMP3({ fileData, url })
    } else {
      this.downloadMP4({ fileData, url })
    }
  }

  // !: Download video as MP3 file
  downloadMP3 = ({ fileData, url }) => {
    // TODO: Add download quality options [normal, high]
    const stream = ytdl(url, {
      quality: 'highestaudio'
    })

    stream.on('progress', throttle(this._throttleValue, this.handleProgress))

    const proc = new ffmpeg({ source: stream }).setFfmpegPath(ffmpegPath)

    proc
      .format('mp3')
      .audioBitrate(192)
      .save(fileData.path)
      .on('end', () => this.handleFinish({ fileData, extension: 'mp3' }))
      .on('error', this.handleError)
  }

  // !: Download video as MP4 file
  downloadMP4 = ({ fileData, url }) => {
    // TODO: Fix mp4 video quality
    // https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js

    ytdl(url, {
      quality: 'highest'
    })
      .on('error', this.handleError)
      .on('progress', throttle(this._throttleValue, this.handleProgress))
      .pipe(fs.createWriteStream(fileData.path))
      .on('finish', () => this.handleFinish({ fileData, extension: 'mp4' }))
  }
}

module.exports = Downloader
