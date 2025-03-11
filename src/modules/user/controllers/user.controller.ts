import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersDocument } from '@user/schemas/user.schema';
import { UserService } from '@user/services/user.service';

@Controller('user')
@ApiTags('Users')
export class UserController {
  constructor(private readonly users_service: UserService) {}
  @Get()
  @ApiOperation({ summary: 'list all users' })
  async GetUsers(): Promise<UsersDocument[]> {
    return await this.users_service.getUsers();
  }
  @Get('/:id')
  @ApiOperation({ summary: 'list user by ID' })
  async getUserByID(@Param('id') id: string): Promise<UsersDocument> {
    return await this.users_service.getUserByID(id);
  }
}
