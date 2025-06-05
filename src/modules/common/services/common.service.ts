import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

@Injectable()
export class CommonService {
  validateMongoID(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }
  validateArryByMongoIDs(ids: string[]) {
    if (!Array.isArray(ids)) return false;
    return ids.every((id) => Types.ObjectId.isValid(id));
  }
  isBase64(str: string): boolean {
    const notBase64 = /[^A-Z0-9+\/=]/i;
    const len = str.length;

    if (!len || len % 4 !== 0 || notBase64.test(str)) {
      return false;
    }

    try {
      atob(str);
      return true;
    } catch {
      return false;
    }
  }
}
