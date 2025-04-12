import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Chat } from "../../models/chat.model";
import { ChatDocument } from "../../schemas/chat.schema";
import { Model } from "mongoose";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
  ) {}
  async getAllChats(): Promise<ChatDocument[]> {
    return this.chatModel.find().populate("sender").exec();
  }
}
