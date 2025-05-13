import { multerS3Config } from "@config/multer.config";

const allowedMimes: string[] = [
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];
export const configImage = multerS3Config("images", 10, allowedMimes);
