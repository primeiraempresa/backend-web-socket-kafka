import { Controller, Get, Injectable, Param, Query, UseGuards } from "@nestjs/common";
import { ChatService } from "../../services/chat/chat.service";
import { ApiOAuth2, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";

@Controller("chat")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(['read', 'write'], 'oauth2') 
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
