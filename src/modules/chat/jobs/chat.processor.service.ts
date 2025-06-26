import { Chats } from "@chat/models/chat.model";
import { ChatsDocument } from "@chat/schemas/chat.schema";
import { ChatService } from "@chat/services/chat.service";
import { InjectQueue, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { FilesDocument } from "@upload/schemas/files.schema";
import { UploadService } from "@upload/services/upload.service";
import { Job, Queue } from "bull";
import { Connection, Model } from "mongoose";

@Processor("chat")
export class ChatProcessorService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Chats.name) private readonly chatModel: Model<ChatsDocument>,
    private readonly chatService: ChatService,
    private readonly uploadService: UploadService,
    @InjectQueue("chat") private readonly queue: Queue,
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
        await this.queue.add("file.delete", {
          files: {
            images: item.images,
            file: item.file,
          },
          job,
        });
      }
      page++;
      if (!message?.nextPage) break;
    }
    await this.connection.dropCollection(`ChatMessage_${collectionName}`);
    await this.chatModel.findByIdAndDelete(collectionName);
    return "chat deleted successfully";
  }
  @Process({
    name: "file.delete",
    concurrency: 1,
  })
  async deleteFile(
    job: Job<{
      files: {
        images: FilesDocument[];
        file: FilesDocument;
      };
      job: Job<ChatsDocument>;
    }>,
  ) {
    if (job.data.files?.images) {
      for (const item2 of job.data.files.images) {
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
    if (job.data.files?.file) {
      try {
        await this.uploadService.deleteFile(job.data.files.file._id.toString());
      } catch (error) {
        this.logger.error(
          `Erro ao deletar imagem ${job.data.files.file._id.toString()}:`,
          error,
        );
        job.log(
          `Erro ao deletar imagem ${job.data.files.file._id.toString()}: ${error}`,
        );
      }
    }
    return await job.remove();
  }
}
