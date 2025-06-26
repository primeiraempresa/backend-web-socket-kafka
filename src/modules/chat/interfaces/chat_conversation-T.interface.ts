import { ChatConversation } from "@chat/models/chat_conversation.model";

export interface ChatConversationT {
  chatId: string;
  chat_conversation: ChatConversation;
}

export interface ChatConversationTwS extends ChatConversationT {
  userId: string;
}
