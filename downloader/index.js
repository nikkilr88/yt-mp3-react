const fs = require('fs')
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

class Downloader {
  constructor({ outputPath }) {
    this._outputPath = outputPath
    this._throttleValue = 100
  }

  downloadMP4 = async ({ videoId, event }) => {
    // Throw error if the video ID is invalid
    if (!ytdl.validateID(videoId)) {
      event.sender.send('download:error')
      throw new Error('Invalid URL')
    }

    const url = `http://www.youtube.com/watch?v=${videoId}`
    const videoInfo = await ytdl.getBasicInfo(url)
    const videoTitle = sanitize(videoInfo.player_response.videoDetails.title)
    const path = `${this._outputPath}/${videoTitle}.mp4`

    return new Promise((resolve, reject) => {
      ytdl(url, {
        quality: 'highest'
      })
        .on(
          'progress',
          throttle(this._throttleValue, (_, downloaded, total) => {
            const percentage = (downloaded / total) * 100
            event.sender.send('download:progress', percentage)
          })
        )
        .pipe(fs.createWriteStream(path))
        .on('finish', () => {
          setTimeout(() => {
            event.sender.send('download:success')

            resolve({
              videoTitle,
              file: path,
              extension: 'mp4'
            })
          }, this._throttleValue)
        })
        .on('error', () => {
          event.sender.send('download:error')
        })
    })
  }
}

module.exports = Downloader
