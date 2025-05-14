import { UsersDocument } from "@user/schemas/user.schema";

export class UserPagination {
  items: UsersDocument[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
