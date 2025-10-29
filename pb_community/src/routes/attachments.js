const { Hono } = require('hono')
const formidable = require('formidable')
const fs = require('fs')
const path = require('path')

const app = new Hono()

app.post('/posts', async (c) => {
  return new Promise((resolve) => {
    const form = formidable({ multiples: false, uploadDir: './uploads', keepExtensions: true})

    form.parse(c.req.raw, async (err, fields, files) => {
      if (err) {
        resolve(c.json({ error: 'アップロード失敗 '}, 500))
        return
      }

      const content = fields.content || ''
      const filePath = files.file?.filepath ? path.basename(files.file.filepath) :null

      resolve(c.json({ message: '投稿成功', fileUrl: filePath ?  `/uploads/${filePath}`: null }))
    })
  })
})

app.get('/uploads/:filename',async (c) => {
  const filePath = path.join('./uploads', c.req.param('filename'))
  return c. body(fs.readFileSync(filePath))
})

module.exports = app