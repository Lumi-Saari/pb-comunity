const { Hono } = require ('hono');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');

const upload = new Hono();

upload.use(ensureAuthenticated());

const sharp = require('sharp');

upload.post('/', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.json({ error: 'ログインしてください' }, 401);

  const formData = await c.req.parseBody();
  const file = formData.icon;
  if (!file || !file.name || !file.arrayBuffer) {
    return c.json({ error: 'ファイルが選択されていません' }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadDir = path.join(__dirname, '../../public/uploads', user.userId);
  await mkdir(uploadDir, { recursive: true });

  // 元画像
  const originalPath = path.join(uploadDir, file.name);
  await writeFile(originalPath, buffer);

  // WebP 変換・圧縮（一覧表示用）
  const ext = path.extname(file.name);
  const nameWithoutExt = path.basename(file.name, ext);
  const webpName = nameWithoutExt + '.webp';
  const webpPath = path.join(uploadDir, webpName);

  await sharp(buffer)
    .resize({ width: 800 }) // 横幅800pxまでに縮小
    .webp({ quality: 80 }) // 80%圧縮
    .toFile(webpPath);

  const fileUrl = `/uploads/${user.userId}/${file.name}`;
  const thumbnailUrl = `/uploads/${user.userId}/${webpName}`;

  return c.json({ url: fileUrl, thumbnail: thumbnailUrl });
});


module.exports = upload;