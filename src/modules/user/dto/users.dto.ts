import { Users } from '@user/models/user.model';
import { ObjectId } from 'mongoose';

export class UsersDto extends Users {
  _id: ObjectId | string;
  __v: number;
}
