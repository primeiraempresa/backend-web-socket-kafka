import { SchemaFactory } from "@nestjs/mongoose";
import { Chat_conversation } from "../models/chat_conversation.model";
import {
  CallbackWithoutResultAndOptionalError,
  HydratedDocument,
} from "mongoose";
import { DateService } from "@common/services/date.service";

export const ChatConversationSchema =
  SchemaFactory.createForClass(Chat_conversation);
export type ChatConversationDocument = HydratedDocument<Chat_conversation>;

ChatConversationSchema.pre(
  "save",
  function (next: CallbackWithoutResultAndOptionalError) {
    if (!this.createdAt) {
      this.createdAt = new DateService().now();
    }
    next();
  },
);
