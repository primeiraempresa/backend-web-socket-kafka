import { SchemaFactory } from "@nestjs/mongoose";
import { Chat } from "../models/chat.model";
import { HydratedDocument } from "mongoose";

export const Chat_schema = SchemaFactory.createForClass(Chat);
export type ChatDocument = HydratedDocument<Chat>;
