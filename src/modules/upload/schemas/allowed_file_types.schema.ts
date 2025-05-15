import { SchemaFactory } from "@nestjs/mongoose";
import { Allowed_file_types } from "../models/allowed_file_types.model";
import { HydratedDocument } from "mongoose";

export const Allowed_file_typesSchema =
  SchemaFactory.createForClass(Allowed_file_types);
export type Allowed_file_typesDocument = HydratedDocument<Allowed_file_types>;
