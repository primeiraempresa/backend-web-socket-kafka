export interface IPagination<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
