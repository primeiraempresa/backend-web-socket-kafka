import { Chats } from "@chat/models/chat.model";
import { ChatsDocument } from "@chat/schemas/chat.schema";
import { ChatConversationDocument } from "@chat/schemas/chat_conversation.schema";
import { ChatService } from "@chat/services/chat.service";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { UploadService } from "@upload/services/upload.service";
import { Job } from "bull";
import { Connection, Model } from "mongoose";

@Processor("chat")
export class ChatProcessorService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    private readonly chatService: ChatService,
    private readonly uploadService: UploadService,
  ) {}
  private readonly logger: Logger = new Logger(ChatProcessorService.name);

  @Process({
    name: "chat.delete",
    concurrency: 1,
  })
  async chatDelete(job: Job<ChatsDocument>): Promise<string> {
    const collectionName = job.data._id.toString();

    let page = 1;
    while (true) {
      const message = await this.chatService.getMessages(
        collectionName,
        page,
        1,
      );
      for (const item of message.items) {
        await this.deleteFile(item, job);
      }
      page++;
      if (!message?.nextPage) break;
    }
    await this.connection.dropCollection(`ChatMessage_${collectionName}`);
    await this.chatModel.findByIdAndDelete(collectionName);
    return "chat deleted successfully";
  }
  private async deleteFile(
    chat_conversation: ChatConversationDocument,
    job: Job<ChatsDocument>,
  ) {
    if (chat_conversation?.images) {
      for (const item2 of chat_conversation.images) {
        try {
          await this.uploadService.deleteFile(item2._id.toString());
        } catch (error) {
          this.logger.error(
            `Erro ao deletar imagem ${item2._id.toString()}:`,
            error,
          );
          job.log(`Erro ao deletar imagem ${item2._id.toString()}:${error}`);
        }
      }
    }
    if (chat_conversation?.file) {
      try {
        await this.uploadService.deleteFile(
          chat_conversation.file._id.toString(),
        );
      } catch (error) {
        this.logger.error(
          `Erro ao deletar imagem ${chat_conversation._id.toString()}:`,
          error,
        );
        job.log(
          `Erro ao deletar imagem ${chat_conversation._id.toString()}: ${error}`,
        );
      }
    }
  }
}
