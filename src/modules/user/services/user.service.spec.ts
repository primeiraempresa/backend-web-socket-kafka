import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import * as bcrypt from "bcryptjs";
import { UserService } from "./user.service";
import { Users } from "@user/models/user.model";
import { CacheService } from "@common/services/cache.service";

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe("UserService", () => {
  let service: UserService;

  const mockUsersModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCacheService = {
    getFromCache: jest.fn(),
    setToCache: jest.fn(),
    deleteFromCache: jest.fn(),
  };

  const createFindQueryMock = (execResult: any) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(execResult),
  });

  const createFindByIdQueryMock = (execResult: any) => ({
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(execResult),
  });

  const createFindByIdAndUpdateQueryMock = (execResult: any) => ({
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(execResult),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(Users.name, "Datas"),
          useValue: mockUsersModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUsers", () => {
    it("should return paginated users", async () => {
      const items = [{ _id: "1", username: "john" }];
      const totalItems = 10;

      mockUsersModel.find.mockReturnValue(createFindQueryMock(items));
      mockUsersModel.countDocuments.mockResolvedValue(totalItems);

      const result = await service.getUsers(1, 5);

      expect(result).toEqual({
        items,
        totalItems,
        totalPages: 2,
        currentPage: 1,
        nextPage: 2,
      });
      expect(mockUsersModel.find).toHaveBeenCalled();
      expect(mockUsersModel.countDocuments).toHaveBeenCalled();
    });

    it("should throw NotFoundException when no users are found", async () => {
      mockUsersModel.find.mockReturnValue(createFindQueryMock([]));
      mockUsersModel.countDocuments.mockResolvedValue(0);

      await expect(service.getUsers(1, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getUserByID", () => {
    it("should throw NotFoundException when id is invalid", async () => {
      await expect(service.getUserByID("invalid-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return cached user when cache exists", async () => {
      const cachedUser = { _id: "507f1f77bcf86cd799439011", username: "john" };

      mockCacheService.getFromCache.mockResolvedValue(cachedUser);

      const result = await service.getUserByID("507f1f77bcf86cd799439011");

      expect(result).toBe(cachedUser);
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(
        "user_507f1f77bcf86cd799439011",
      );
      expect(mockUsersModel.findById).not.toHaveBeenCalled();
    });

    it("should fetch user from database and cache it when cache is empty", async () => {
      const user = { _id: "507f1f77bcf86cd799439011", username: "john" };

      mockCacheService.getFromCache.mockResolvedValue(null);
      mockUsersModel.findById.mockReturnValue(createFindByIdQueryMock(user));

      const result = await service.getUserByID("507f1f77bcf86cd799439011");

      expect(result).toBe(user);
      expect(mockUsersModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
      );
      expect(mockCacheService.setToCache).toHaveBeenCalledWith(
        "user_507f1f77bcf86cd799439011",
        user,
      );
    });

    it("should throw NotFoundException when user does not exist", async () => {
      mockCacheService.getFromCache.mockResolvedValue(null);
      mockUsersModel.findById.mockReturnValue(createFindByIdQueryMock(null));

      await expect(
        service.getUserByID("507f1f77bcf86cd799439011"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("registerUser", () => {
    it("should create a user with encrypted password", async () => {
      const body = {
        email: "john@example.com",
        username: "john",
        password: "123456",
      } as any;

      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
      mockUsersModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUsersModel.create.mockResolvedValue({
        _id: "1",
        ...body,
        password: "hashed-password",
      });

      const result = await service.registerUser(body);

      expect(bcrypt.hash).toHaveBeenCalledWith("123456", 10);
      expect(mockUsersModel.create).toHaveBeenCalledWith({
        ...body,
        password: "hashed-password",
      });
      expect(result).toEqual({
        _id: "1",
        email: "john@example.com",
        username: "john",
        password: "hashed-password",
      });
    });

    it("should throw BadRequestException when email is already registered", async () => {
      mockUsersModel.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: "1", email: "john@example.com" }),
      });

      await expect(
        service.registerUser({
          email: "john@example.com",
          username: "john2",
          password: "123456",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateUser", () => {
    it("should update the user and hash the password when provided", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const currentUser = {
        _id: userId,
        email: "john@example.com",
        username: "john",
        password: "old-password",
      };

      const body = {
        password: "new-password",
      } as any;

      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-new-password");
      mockCacheService.getFromCache.mockResolvedValue(null);
      mockUsersModel.findById.mockReturnValue(
        createFindByIdQueryMock(currentUser),
      );
      mockUsersModel.findByIdAndUpdate.mockReturnValue(
        createFindByIdAndUpdateQueryMock({
          ...currentUser,
          password: "hashed-new-password",
        }),
      );

      const result = await service.updateUser(body, userId);

      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(
        `user_${userId}`,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith("new-password", 10);
      expect(mockUsersModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          password: "hashed-new-password",
        },
        {
          new: true,
          runValidators: true,
        },
      );
      expect(result).toEqual({
        ...currentUser,
        password: "hashed-new-password",
      });
    });

    it("should throw NotFoundException when user does not exist", async () => {
      const userId = "507f1f77bcf86cd799439011";

      mockCacheService.getFromCache.mockResolvedValue(null);
      mockUsersModel.findById.mockReturnValue(createFindByIdQueryMock(null));

      await expect(service.updateUser({} as any, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("loginUser", () => {
    it("should return the user when credentials are valid", async () => {
      const user = {
        _id: "1",
        email: "john@example.com",
        username: "john",
        password: "hashed-password",
      };

      mockUsersModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.loginUser({
        user: "john",
        password: "123456",
      } as any);

      expect(result).toBe(user);
      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed-password");
    });

    it("should throw UnauthorizedException when user is not found", async () => {
      mockUsersModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.loginUser({
          user: "john",
          password: "123456",
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when password is invalid", async () => {
      mockUsersModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: "1",
          email: "john@example.com",
          username: "john",
          password: "hashed-password",
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.loginUser({
          user: "john",
          password: "wrong-password",
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("deleteUser", () => {
    it("should delete the user after login validation", async () => {
      const userId = "507f1f77bcf86cd799439011";

      jest.spyOn(service, "loginUser").mockResolvedValue({
        _id: "1",
        email: "john@example.com",
        username: "john",
        password: "hashed-password",
      } as any);

      mockUsersModel.findOneAndDelete.mockResolvedValue({
        _id: userId,
        email: "john@example.com",
      });

      const result = await service.deleteUser(
        {
          user: "john",
          password: "123456",
        } as any,
        userId,
      );

      expect(service.loginUser).toHaveBeenCalledWith({
        user: "john",
        password: "123456",
      });
      expect(mockCacheService.deleteFromCache).toHaveBeenCalledWith(
        `user_${userId}`,
      );
      expect(mockUsersModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: userId,
      });
      expect(result).toEqual({
        _id: userId,
        email: "john@example.com",
      });
    });
  });
});
