import { Test, TestingModule } from "@nestjs/testing";
import { UserController } from "./user.controller";
import { UserService } from "@user/services/user.service";
import { UsersDocument } from "@user/schemas/user.schema";
import { UserLogin } from "@user/dto/user_login.dto";
import { Users } from "@user/models/user.model";
import { UsersDto } from "@user/dto/users.dto";
import { getModelToken } from "@nestjs/mongoose";

describe("UserController", () => {
  let controller: UserController;
  const mockUserService = {
    getUsers: jest.fn(),
    getUserByID: jest.fn(),
    registerUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    loginUser: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: getModelToken("Users"),
          useValue: {},
        },
      ],
    }).compile();
    controller = module.get<UserController>(UserController);
  });

  describe("GetUsers", () => {
    it("should return paginated users", async () => {
      const result: any = { users: [], totalCount: 0 };
      mockUserService.getUsers.mockResolvedValue(result);

      const response = await controller.GetUsers(1, 10);
      expect(response).toEqual(result);
      expect(mockUserService.getUsers).toHaveBeenCalledWith(1, 10);
    });
  });

  describe("getUserByID", () => {
    it("should return a user by ID", async () => {
      const mockUser = { _id: "1", username: "test" };
      mockUserService.getUserByID.mockResolvedValue(mockUser);

      const response = await controller.getUserByID("1");
      expect(response).toEqual(mockUser);
      expect(mockUserService.getUserByID).toHaveBeenCalledWith("1");
    });
  });

  describe("registerUser", () => {
    it("should register a user", async () => {
      const mockUser: Users = { username: "test", password: "password" } as any;
      const createdUser: UsersDocument = { _id: "1", username: "test" } as any;
      mockUserService.registerUser.mockResolvedValue(createdUser);

      const response = await controller.registerUser(mockUser);
      expect(response).toEqual(createdUser);
      expect(mockUserService.registerUser).toHaveBeenCalledWith(mockUser);
    });
  });

  describe("updateUser", () => {
    it("should update a user by ID", async () => {
      const updateUserDto: UsersDto = { username: "updatedUser" } as any;
      const updatedUser: UsersDocument = {
        _id: "1",
        username: "updatedUser",
      } as any;
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const response = await controller.updateUser(updateUserDto, "1");
      expect(response).toEqual(updatedUser);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        updateUserDto,
        "1",
      );
    });
  });

  describe("deleteUser", () => {
    it("should delete a user by ID", async () => {
      const mockLogin: UserLogin = {
        username: "test",
        password: "password",
      } as any;
      mockUserService.deleteUser.mockResolvedValue({});

      const response = await controller.deleteUser(mockLogin, "1");
      expect(response).toEqual({});
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(mockLogin, "1");
    });
  });

  describe("login", () => {
    it("should login a user", async () => {
      const mockLogin: UserLogin = {
        username: "test",
        password: "password",
      } as any;
      const loggedInUser: UsersDocument = { _id: "1", username: "test" } as any;
      mockUserService.loginUser.mockResolvedValue(loggedInUser);

      const response = await controller.login(mockLogin);
      expect(response).toEqual(loggedInUser);
      expect(mockUserService.loginUser).toHaveBeenCalledWith(mockLogin);
    });
  });
});
