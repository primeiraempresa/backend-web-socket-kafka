import { IUploadedFile } from "./UploadedFile.interface";

export interface IReq extends Request {
  file?: Partial<IUploadedFile>;
}
