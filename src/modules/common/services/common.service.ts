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
}
