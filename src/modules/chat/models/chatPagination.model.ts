import { HydratedDocument } from "mongoose";
import { ChatConversation } from "./chat_conversation.model";

export class ChatPagination {
  items: HydratedDocument<ChatConversation>[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
