import { ChatConversationDTO } from "@chat/dto/chat_conversation.dto";

export interface Chat_conversation_messageT {
  chatId: string;
  messageId: string;
  chat_conversation: ChatConversationDTO;
}
export interface Chat_conversation_messageT_Ws extends Chat_conversation_messageT {
  userId: string;
}
