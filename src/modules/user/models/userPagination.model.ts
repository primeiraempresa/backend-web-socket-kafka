import { HydratedDocument } from "mongoose";
import { Users } from "./user.model";

export class UserPagination {
  items: HydratedDocument<Users>[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
