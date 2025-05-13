export interface IUploadedFile extends Express.Multer.File {
  location: string;
  key: string;
  bucket: string;
  etag: string;
  acl?: string;
  contentType?: string;
  encoding: string;
  mimetype: string;
  size: number;
  contentDisposition: null;
  contentEncoding: null;
  storageClass: string;
  serverSideEncryption: null;
}
