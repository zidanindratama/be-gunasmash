import { Router } from 'express';
import multer from 'multer';

import { authGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import { uploadImage } from '../common/upload/cloudinary.js';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function isSupportedImage(mimetype: string, buffer: Buffer) {
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isGif = buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return (
    (mimetype === 'image/png' && isPng) ||
    (mimetype === 'image/jpeg' && isJpeg) ||
    (mimetype === 'image/gif' && isGif) ||
    (mimetype === 'image/webp' && isWebp)
  );
}

export const uploadRouter = Router();

uploadRouter.post('/image', authGuard, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw Object.assign(new Error('File required'), { status: 400 });
    if (!isSupportedImage(req.file.mimetype, req.file.buffer)) {
      throw Object.assign(new Error('Only valid PNG, JPEG, GIF, and WebP images are allowed'), {
        status: 400,
      });
    }
    const out = await uploadImage(req.file.buffer, 'gunasmash');
    res.json(ok(out));
  } catch (e) {
    next(e);
  }
});
