import { Request } from "express";
import { randomBytes } from "crypto";
import { StorageEngine } from "multer";
import { s3 } from "./s3.config";
import { PayloadTooLargeException } from "@nestjs/common";
import path from "path";
import * as multerS3 from "multer-s3";
/**
 * Gera a configuração do Multer usando S3 para upload de arquivos.
 *
 * @param bucket - Nome do bucket onde os arquivos serão armazenados.
 * @param size - Tamanho do arquivo em bytes.
 * @param allowedMimes - Tipos MIME permitidos para upload.
 * @param acl - Controle de acesso do arquivo (opcional).
 * @param max_file_size - Tamanho máximo do arquivo em MB (opcional).
 * @returns Configuração do Multer para armazenar arquivos no S3.
 */
export const multerS3Config = (
  bucket: string,
  size: number,
  allowedMimes: string[],
  acl?: string,
  max_file_size?: number,
) => {
  const MAX_FILE_SIZE = max_file_size ?? 10 * 1024 * 1024;
  if (size > MAX_FILE_SIZE) {
    throw new PayloadTooLargeException("File exceeds allowed limit.");
  }
  const storageTypes: StorageEngine = multerS3({
    s3,
    bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: acl ?? "public-read",
    key: (
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, key?: string) => void,
    ) => {
      randomBytes(16, (err, hash) => {
        if (err) return cb(err);
        const filename = `${hash.toString("hex")}-${file.originalname}`;
        cb(null, filename);
      });
    },
  });
  return {
    storage: storageTypes,
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
    fileFilter: (req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new PayloadTooLargeException("Invalid file type"));
      }
    },
  };
};
