import { SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { Chats } from "../models/chat.model";

export const Chats_schema = SchemaFactory.createForClass(Chats);
export type ChatsDocument = HydratedDocument<Chats>;
