import { SchemaFactory } from "@nestjs/mongoose";
import { ChatConversation } from "../models/chat_conversation.model";
import {
  CallbackWithoutResultAndOptionalError,
  HydratedDocument,
} from "mongoose";
import { DateService } from "@common/services/date.service";

export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);
export type ChatConversationDocument = HydratedDocument<ChatConversation>;

ChatConversationSchema.pre(
  "save",
  function (next: CallbackWithoutResultAndOptionalError) {
    this.createdAt ??= new DateService().now();
    next();
  },
);
