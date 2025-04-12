import { Controller, Get, Injectable, Param, Query } from "@nestjs/common";
import { ChatService } from "../../services/chat/chat.service";
import { ApiQuery, ApiTags } from "@nestjs/swagger";

@Controller("chat")
@ApiTags("Chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number for pagination",
  })
    @ApiQuery({
        name: "perPage",
        required: false,
        type: Number,
        description: "Number of items per page",
    })
  @Get(":chatId")
  async getAllChats(
    @Param("chatId") chatId: string,
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ) {
    return await this.chatService.getMessages(
      chatId,
      page ? parseInt(page.toString()) : 1,
      perPage ? parseInt(perPage.toString()) : 10,
    );
  }
}
