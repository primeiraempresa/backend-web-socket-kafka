import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Users } from "@user/models/user.model";
import { UsersDocument } from "@user/schemas/user.schema";
import { Model, ObjectId, isValidObjectId } from "mongoose";
import * as bcrypt from "bcryptjs";
import { UsersDto } from "@user/dto/users.dto";
import { UserLogin } from "@user/dto/user_login.dto";
import { Cache } from "cache-manager";
import { UserPagination } from "@user/models/userPagination.model";
@Injectable()
export class UserService {
  constructor(
    @InjectModel(Users.name) private readonly usersModel: Model<UsersDocument>,
    @Inject("CACHE_MANAGER") private cacheManager: Cache,
  ) {}
  async getUsers(page: number, limit: number): Promise<UserPagination> {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
      await this.usersModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("profilePic")
        .exec(),
      await this.usersModel.countDocuments(),
    ]);
    if (!items || items.length < 1) {
      throw new NotFoundException(["no users found"]);
    }
    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page * limit < totalItems ? page + 1 : null,
    };
  }
  async getUserByID(_id: ObjectId | string): Promise<UsersDocument> {
    if (!isValidObjectId(_id)) {
      throw new NotFoundException(["user not found"]);
    }
    const cacheKey = `user_${_id.toString()}`;
    const cachedUser: UsersDocument | null =
      await this.cacheManager.get<UsersDocument>(cacheKey);
    if (cachedUser) return cachedUser;
    const user = await this.usersModel
      .findById(_id)
      .populate("profilePic")
      .exec();
    if (!user) {
      throw new NotFoundException(["user not found"]);
    }
    await this.cacheManager.set(cacheKey, user);
    return user;
  }
  async registerUser(body: Users): Promise<UsersDocument> {
    await this.emailExist(body.email);
    await this.userNameExist(body.username);
    const { password } = body;
    const encryptedPassowrd = await bcrypt.hash(password, 10);
    body.password = encryptedPassowrd;
    return await this.usersModel.create(body);
  }
  async updateUser(
    body: UsersDto,
    _id: ObjectId | string,
  ): Promise<UsersDocument> {
    const cacheKey = `user_${_id.toString()}`;
    const user = await this.getUserByID(_id);
    if (body?.email && body.email !== user.email) {
      await this.emailExist(body?.email);
    }
    if (body?.username && body.username !== user.username) {
      await this.userNameExist(body?.username);
    }
    await this.cacheManager.del(cacheKey);
    const updatedUser = await this.usersModel
      .findByIdAndUpdate(user._id, body, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException(["user not found"]);
    }
    return updatedUser;
  }
  async loginUser(userLogin: UserLogin): Promise<UsersDocument> {
    const user = await this.findUser(userLogin.user);
    const message = "username/email ou senha incorreto. ";
    if (!user) {
      throw new UnauthorizedException([message]);
    }
    const isPasswordValid = await bcrypt.compare(
      userLogin.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException([message]);
    }
    return user;
  }

  async deleteUser(userLogin: UserLogin, _id: string) {
    await this.loginUser(userLogin);
    const cacheKey = `user_${_id}`;
    await this.cacheManager.del(cacheKey);
    return await this.usersModel.findOneAndDelete({ _id });
  }
  private async findUser(user: string): Promise<UsersDocument | null> {
    const userFind = await this.usersModel
      .findOne({
        $or: [{ email: user }, { username: user }],
      })
      .exec();
    return userFind;
  }

  private async emailExist(email: string): Promise<boolean> {
    const existingUserByEmail = await this.findUser(email);
    if (existingUserByEmail) {
      throw new BadRequestException(["Email already registered. "]);
    }
    return false;
  }

  private async userNameExist(username: string): Promise<boolean> {
    const existingUser = await this.findUser(username);
    if (existingUser) {
      throw new BadRequestException(["username already registered. "]);
    }
    return false;
  }
}
