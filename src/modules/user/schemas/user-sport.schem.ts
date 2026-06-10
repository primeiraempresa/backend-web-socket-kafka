import { SchemaFactory } from "@nestjs/mongoose";
import { UserSport } from "@user/models/user-sport.model";
import { HydratedDocument } from "mongoose";

export const UserSport_schema = SchemaFactory.createForClass(UserSport);
export type UserSportDocument = HydratedDocument<UserSport>;
