import { ChatConversation } from "@chat/models/chat_conversation.model";
import { ApiProperty } from "@nestjs/swagger";
import { ChatConversationDTO } from "./chat_conversation.dto";

export class getAllChatsApiSendDTO {
  @ApiProperty({ description: "usersID for search", required: false })
  userIds?: string[];
  @ApiProperty({ description: "chatID for search", required: false })
  chatId?: string;
}

export class getChatsByUserIdDTO {
  @ApiProperty({ description: "usersID", required: true })
  userId!: string;
}

export class getMessagensDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
  @ApiProperty({
    description: "Page number for pagination",
    type: Number,
    required: false,
  })
  page?: number;
  @ApiProperty({
    description: "Number of items per page",
    type: Number,
    required: false,
  })
  perPage?: number;
}

export class getMessageByIdDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
  @ApiProperty({ description: "messageId", type: String, required: true })
  messageId!: string;
}

export class createMessageDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
  @ApiProperty({
    description: "chat_conversation",
    type: ChatConversation,
    required: true,
  })
  chat_conversation!: ChatConversation;
}

export class updateMessageDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
  @ApiProperty({ description: "messageId", type: String, required: true })
  messageId!: string;
  @ApiProperty({
    description: "chat_conversation",
    type: ChatConversationDTO,
    required: true,
  })
  chat_conversation!: ChatConversationDTO;
}

export class deleteMessageDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
  @ApiProperty({ description: "messageId", type: String, required: true })
  messageId!: string;
}

export class deleteChatDTO {
  @ApiProperty({ description: "chatID", type: String, required: true })
  chatId!: string;
}
