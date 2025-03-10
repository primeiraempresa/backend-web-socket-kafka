import { SchemaFactory } from '@nestjs/mongoose';
import { Users } from '@user/models/user.model';

export const Users_schema = SchemaFactory.createForClass(Users);
