import {
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Users } from "@user/models/user.model";
import { UsersDocument } from "@user/schemas/user.schema";
import { Model, isValidObjectId } from "mongoose";
import * as bcrypt from "bcryptjs";
import { UsersDto } from "@user/dto/users.dto";
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
      throw new NotFoundException(["no users found"]);
    }
    return users;
  }
  async getUserByID(_id: string): Promise<UsersDocument> {
    if (!isValidObjectId(_id)) {
      throw new NotFoundException(["user not found"]);
    }
    const user = await this.usersModel
      .findById(_id)
      // .populate('profilePic')
      .exec();
    if (!user) {
      throw new NotFoundException(["user not found"]);
    }
    return user;
  }
  async registerUser(body: Users): Promise<UsersDocument> {
    await this.emailExist(body.email);
    await this.userNameExist(body.username);
    const { password } = body;
    const encryptedPassowrd = await bcrypt.hash(password, 10);
    body.password = encryptedPassowrd;
    Logger.debug(body);
    return await this.usersModel.create(body);
  }
  async updateUser(
    body: UsersDto,
    id: string,
  ): Promise<UsersDocument | unknown> {
    console.log(body);
    const user = await this.getUserByID(id);
    console.log(user)
    if (body?.email && body.email !== user.email) {
      await this.emailExist(body?.email);
    }
    if (body?.username && body.username !== user.username) {
      await this.userNameExist(body?.username);
    }
    return await this.usersModel
      .findByIdAndUpdate(user._id, body, {
        new: true, // Retorna o documento atualizado
        runValidators: true, // Garante que as validações do Mongoose sejam aplicadas
      })
      .exec();
  }

  private async emailExist(email: string): Promise<boolean> {
    const existingUserByEmail = await this.usersModel.findOne({ email }).exec();
    if (existingUserByEmail) {
      throw new NotAcceptableException(["Email already registered. "]);
    }
    return false;
  }
  private async userNameExist(username: string): Promise<boolean> {
    const existingUser = await this.usersModel.findOne({ username }).exec();
    if (existingUser) {
      throw new NotAcceptableException(["username already registered. "]);
    }
    return false;
  }
}
