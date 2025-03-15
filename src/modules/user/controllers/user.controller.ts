import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsersDto } from "@user/dto/users.dto";
import { Users } from "@user/models/user.model";
import { UsersDocument } from "@user/schemas/user.schema";
import { UserService } from "@user/services/user.service";

@Controller("user")
@ApiTags("Users")
export class UserController {
  constructor(private readonly users_service: UserService) {}
  @Get()
  @ApiOperation({ summary: "list all users" })
  async GetUsers(): Promise<UsersDocument[]> {
    return await this.users_service.getUsers();
  }
  @Get("/:id")
  @ApiOperation({ summary: "list user by ID" })
  async getUserByID(@Param("id") id: string): Promise<UsersDocument> {
    return await this.users_service.getUserByID(id);
  }
  @Post()
  @ApiOperation({ summary: "register the user" })
  async registerUser(@Body() body: Users) {
    return await this.users_service.registerUser(body);
  }
  @Put("/:id")
  @ApiOperation({ summary: "update the user by ID" })
  async updateUser(@Body() body: UsersDto, @Param("id") id: string) {
    return await this.users_service.updateUser(body, id);
  }
}
