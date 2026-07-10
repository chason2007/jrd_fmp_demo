import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../config/storage.js';
import { HttpError } from '../utils/httpError.js';

// Memory storage: we inspect the buffer (magic bytes + hash) and write the file
// ourselves with a server-generated name — never the client's filename.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single('photo');

/** Run multer and translate its errors into safe 400s through our error pipeline. */
export function uploadSinglePhoto(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large.' : 'Invalid file upload.';
        return next(new HttpError(400, msg));
      }
      return next(err);
    }
    next();
  });
}
