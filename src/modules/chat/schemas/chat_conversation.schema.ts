import { SchemaFactory } from "@nestjs/mongoose";
import { Chat_conversation } from "../models/chat_conversation.model";
import { HydratedDocument } from "mongoose";

export const ChatConversationSchema =
  SchemaFactory.createForClass(Chat_conversation);
export type ChatConversationDocument = HydratedDocument<Chat_conversation>;
