const fs = require('fs')
const EventEmitter = require('events')
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const sanitize = require('sanitize-filename')
const { throttle } = require('throttle-debounce')

/*

  TODO: Add event emitter and move all event.sender.send calls into main file
  For example, we want to be able to call downloader.on('finish')

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
        this.emit('error', new Error('Invalid video ID'))
        this.removeAllListeners()
      })
    }

    return isValid
  }

  // TODO: Refactor this to return a promise
  generateFileData = async ({ extension, url }) => {
    const videoInfo = await ytdl.getBasicInfo(url)
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)
    return {
      videoTitle,
      path: `${this._outputPath}/${videoTitle}.${extension}`
    }
  }

  // !: Download video as MP3 file
  downloadMP3 = async ({ videoId }) => {
    if (!this.validateID({ videoId })) return

    const url = `http://www.youtube.com/watch?v=${videoId}`
    const fileData = await this.generateFileData({ extension: 'mp3', url })

    // TODO: Add download quality options [normal, high]
    const stream = ytdl(url)

    stream.on(
      'progress',
      throttle(this._throttleValue, (_, downloaded, total) => {
        const percentage = (downloaded / total) * 100
        this.emit('progress', percentage)
      })
    )

    const proc = new ffmpeg({ source: stream }).setFfmpegPath(ffmpegPath)
    proc
      .format('mp3')
      .save(fileData.path)
      .on('end', () => {
        this.emit('finish', {
          file: fileData.path,
          extension: 'mp3',
          videoTitle: fileData.videoTitle
        })
        this.removeAllListeners()
      })
  }

  // !: Download video as MP4 file
  downloadMP4 = async ({ videoId }) => {
    if (!this.validateID({ videoId })) return

    const url = `http://www.youtube.com/watch?v=${videoId}`
    const videoInfo = await ytdl.getBasicInfo(url)
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)
    const path = `${this._outputPath}/${videoTitle}.mp4`

    ytdl(url, {
      quality: 'highest'
    })
      .on(
        'progress',
        throttle(this._throttleValue, (_, downloaded, total) => {
          const percentage = (downloaded / total) * 100
          this.emit('progress', percentage)
        })
      )
      .pipe(fs.createWriteStream(path))
      .on('finish', () => {
        setTimeout(() => {
          this.emit('finish', {
            videoTitle,
            file: path,
            extension: 'mp4'
          })
          this.removeAllListeners()
        }, this._throttleValue)
      })
  }
}

module.exports = Downloader
