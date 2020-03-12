const fs = require('fs')
const EventEmitter = require('events')
const ytdl = require('ytdl-core')
const sanitize = require('sanitize-filename')
const ffmpegPath = require('ffmpeg-static')
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

  downloadMP4 = async ({ videoId, event }) => {
    // Throw error if the video ID is invalid
    if (!ytdl.validateID(videoId)) {
      process.nextTick(() => {
        this.emit('error', new Error('Invalid video ID'))
        this.removeAllListeners()
      })

      return
    }

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
        }, this._throttleValue)
      })
  }
}

module.exports = Downloader
