import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Users } from '@user/models/user.model';
import { UsersDocument } from '@user/schemas/user.schema';
import { Model, isValidObjectId } from 'mongoose';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(Users.name) private readonly usersModel: Model<UsersDocument>,
  ) {}
  async getUsers(): Promise<UsersDocument[]> {
    const users: UsersDocument[] = await this.usersModel
      .find()
      // .populate('profilePic')
      .exec();
    if (!users || users.length < 1) {
      throw new NotFoundException(['nunhum usuário encontrado']);
    }
    return users;
  }
  async getUserByID(_id: string): Promise<UsersDocument> {
    if (!isValidObjectId(_id)) {
      throw new NotFoundException(['usuário não encontrado']);
    }
    const user = await this.usersModel
      .findById(_id)
      // .populate('profilePic')
      .exec();
    if (!user) {
      throw new NotFoundException(['usuário não encontrado']);
    }
    return user;
  }
}
