const fs = require('fs')

exports.removeFile = path => {
  fs.unlink(path, error => {
    if (error) {
      return console.log('CLEANUP: file not removed!', path)
    }
    console.log('CLEANUP: file removed!', path)
  })

  return
}
