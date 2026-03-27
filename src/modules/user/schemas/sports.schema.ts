import { SchemaFactory } from "@nestjs/mongoose";
import { Sports } from "@user/models/sports.model";
import { HydratedDocument } from "mongoose";

export const Sports_schema = SchemaFactory.createForClass(Sports);
export type SportsDocument = HydratedDocument<Sports>;
