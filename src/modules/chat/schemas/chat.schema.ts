import { SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { Chats } from "../models/chat.model";

export const Chat_schema = SchemaFactory.createForClass(Chats);
export type ChatDocument = HydratedDocument<Chats>;
