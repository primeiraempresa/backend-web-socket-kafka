import { SchemaFactory } from "@nestjs/mongoose";
import { Users } from "@user/models/user.model";
import { HydratedDocument } from "mongoose";

export const Users_schema = SchemaFactory.createForClass(Users);
export type UsersDocument = HydratedDocument<Users>;
