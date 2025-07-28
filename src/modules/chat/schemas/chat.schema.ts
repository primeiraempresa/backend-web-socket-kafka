import { SchemaFactory } from "@nestjs/mongoose";
import {
  CallbackWithoutResultAndOptionalError,
  HydratedDocument,
} from "mongoose";
import { Chats } from "../models/chat.model";
import { DateService } from "@common/services/date.service";

export const Chats_schema = SchemaFactory.createForClass(Chats);
export type ChatsDocument = HydratedDocument<Chats>;
Chats_schema.pre(
  "save",
  function (next: CallbackWithoutResultAndOptionalError) {
    this.createdAt ??= new DateService().now();
    this.updatedAt ??= new DateService().now();
    next();
  },
);
