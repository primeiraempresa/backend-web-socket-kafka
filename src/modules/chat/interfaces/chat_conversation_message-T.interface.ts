import { Chat_conversation_DTO } from "@chat/dto/chat_conversation.dto";

export interface Chat_conversation_messageT {
  chatId: string;
  messageId: string;
  chat_conversation: Chat_conversation_DTO;
}
export interface Chat_conversation_messageT_Ws
  extends Chat_conversation_messageT {
  userId: string;
}
