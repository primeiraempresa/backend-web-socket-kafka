import { Chat_conversation } from "@chat/models/chat_conversation.model";

export interface Chat_conversationT {
  chatId: string;
  chat_conversation: Chat_conversation;
}

export interface Chat_conversationT_WS extends Chat_conversationT {
  userId: string;
}
