export interface IUploadedFile extends Express.Multer.File {
  location: string;
  key: string;
  bucket: string;
  etag: string;
  acl?: string;
  contentType?: string;
  encoding: "7bit";
  mimetype: "image/jpeg";
  size: 41275;
  contentDisposition: null;
  contentEncoding: null;
  storageClass: "STANDARD";
  serverSideEncryption: null;
}
