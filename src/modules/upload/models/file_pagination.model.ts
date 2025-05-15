import { FilesDocument } from "../schemas/files.schema";

export class FilePagination {
  items: FilesDocument[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
