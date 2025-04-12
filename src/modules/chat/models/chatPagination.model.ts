import { HydratedDocument } from "mongoose";
import { Chats } from "./chat.model";
import { Chat_conversation } from "./chat_conversation.model";

export class ChatPagination {
  conversation: HydratedDocument<Chat_conversation>[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
}
