import { SchemaFactory } from "@nestjs/mongoose";
import { Files } from "../models/files.model";
import { HydratedDocument } from "mongoose";

export const FilesSchema = SchemaFactory.createForClass(Files);
export type FilesDocument = HydratedDocument<Files>;
