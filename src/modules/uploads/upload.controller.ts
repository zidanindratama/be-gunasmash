import { Router } from 'express';
import multer from 'multer';

import { authGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import { uploadImage } from '../common/upload/cloudinary.js';

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadRouter = Router();

uploadRouter.post('/image', authGuard, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw Object.assign(new Error('File required'), { status: 400 });
    const out = await uploadImage(req.file.buffer, 'gunasmash');
    res.json(ok(out));
  } catch (e) {
    next(e);
  }
});
