const fs = require('fs')
const EventEmitter = require('events')
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg')
const sanitize = require('sanitize-filename')
const { throttle } = require('throttle-debounce')
let ffmpegPath = require('ffmpeg-static')

ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
/*

  TODO: Fix mp4 video quality
  https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js

*/

class Downloader extends EventEmitter {
  constructor({ outputPath }) {
    super()
    this._outputPath = outputPath
    this._throttleValue = 100
  }

  // !: Check to see if the video id is valid
  // Change this to validate whole URL?
  validateID = ({ videoId }) => {
    const isValid = ytdl.validateID(videoId)

    // Throw error if the video ID is invalid
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

  // TODO: Refactor this to return a promise
  generateFileData = async ({ extension, url }) => {
    const videoInfo = await ytdl.getBasicInfo(url)
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)
    return {
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${extension}`
    }
  }

  // !: Send error
  handleError = () => {
    this.emit('error', new Error('Something went wrong.'))
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

  // !: Download video as MP3 file
  downloadMP3 = async ({ videoId }) => {
    if (!this.validateID({ videoId })) return

    const url = `http://www.youtube.com/watch?v=${videoId}`
    const fileData = await this.generateFileData({ extension: 'mp3', url })

    // TODO: Add download quality options [normal, high]
    const stream = ytdl(url, {
      quality: 'highestaudio'
    })

    stream
      .on('progress', throttle(this._throttleValue, this.handleProgress))
      .on('error', this.handleError)

    const proc = new ffmpeg({ source: stream }).setFfmpegPath(ffmpegPath)

    proc
      .format('mp3')
      .save(fileData.path)
      .on('end', () => this.handleFinish({ fileData, extension: 'mp3' }))
      .on('error', this.handleError)
  }

  // !: Download video as MP4 file
  downloadMP4 = async ({ videoId }) => {
    if (!this.validateID({ videoId })) return

    const url = `http://www.youtube.com/watch?v=${videoId}`
    const fileData = await this.generateFileData({ extension: 'mp3', url })

    ytdl(url, {
      quality: 'highest'
    })
      .on('progress', throttle(this._throttleValue, this.handleProgress))
      .pipe(fs.createWriteStream(fileData.path))
      .on('finish', () => this.handleFinish({ fileData, extension: 'mp4' }))
      .on('error', this.handleError)
  }
}

module.exports = Downloader
