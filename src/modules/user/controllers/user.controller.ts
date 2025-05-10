import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiOAuth2,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UserLogin } from "@user/dto/user_login.dto";
import { UsersDto } from "@user/dto/users.dto";
import { Users } from "@user/models/user.model";
import { UserPagination } from "@user/models/userPagination.model";
import { UsersDocument } from "@user/schemas/user.schema";
import { UserService } from "@user/services/user.service";

@Controller("user")
@UseGuards(AuthGuard("jwt"))
@ApiOAuth2(["read", "write"], "oauth2")
@ApiTags("Users")
export class UserController {
  constructor(private readonly users_service: UserService) {}
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number for pagination",
  })
  @ApiQuery({
    name: "perPage",
    required: false,
    type: Number,
    description: "Number of items per page",
  })
  @Get()
  @ApiOperation({ summary: "list all users" })
  async GetUsers(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ): Promise<UserPagination> {
    return await this.users_service.getUsers(
      page ? parseInt(page.toString()) : 1,
      perPage ? parseInt(perPage.toString()) : 10,
    );
  }

  @Get("/:id")
  @ApiOperation({ summary: "list user by ID" })
  async getUserByID(@Param("id") id: string): Promise<UsersDocument> {
    return await this.users_service.getUserByID(id);
  }

  @Post()
  @ApiOperation({ summary: "register the user" })
  async registerUser(@Body() body: Users): Promise<UsersDocument> {
    return await this.users_service.registerUser(body);
  }

  @Put("/:id")
  @ApiOperation({ summary: "update the user by ID" })
  async updateUser(
    @Body() body: UsersDto,
    @Param("id") id: string,
  ): Promise<UsersDocument | unknown> {
    return await this.users_service.updateUser(body, id);
  }

  @Delete("/:id")
  @ApiOperation({ summary: "delete the user by ID, with login of user" })
  async deleteUser(@Body() user_login: UserLogin, @Param("id") id: string) {
    return await this.users_service.deleteUser(user_login, id);
  }

  @Post("/login")
  @ApiOperation({ summary: "login of user by email/username and password" })
  async login(@Body() user_login: UserLogin): Promise<UsersDocument> {
    return await this.users_service.loginUser(user_login);
  }
}
