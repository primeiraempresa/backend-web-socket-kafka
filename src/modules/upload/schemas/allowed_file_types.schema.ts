import { SchemaFactory } from "@nestjs/mongoose";
import { AllowedFileTypes } from "../models/allowed_file_types.model";
import { HydratedDocument } from "mongoose";

export const Allowed_file_typesSchema =
  SchemaFactory.createForClass(AllowedFileTypes);
export type Allowed_file_typesDocument = HydratedDocument<AllowedFileTypes>;
