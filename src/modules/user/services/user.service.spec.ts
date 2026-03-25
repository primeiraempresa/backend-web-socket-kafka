import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { getModelToken } from "@nestjs/mongoose";
import { Users } from "@user/models/user.model";
import { Cache } from "cache-manager";
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { CacheService } from "@common/services/cache.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";

const mockUser = {
  _id: "507f1f77bcf86cd799439011",
  email: "test@example.com",
  username: "testuser",
  password: "hashedpassword",
  toObject: function () {
    return this;
  },
} as any;
const mockUsersModel = () => ({
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn().mockReturnThis(),
  findByIdAndUpdate: jest.fn().mockReturnThis(),
  findOneAndDelete: jest.fn(),
  findOne: jest.fn().mockReturnThis(),
  create: jest.fn(),
});
describe("UserService", () => {
  let service: UserService;
  let usersModel: ReturnType<typeof mockUsersModel>;
  let cacheManager: Cache;
  let mockCacheManager: jest.Mocked<Cache>;
  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Cache>;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(Users.name, "Datas"),
          useFactory: mockUsersModel,
        },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();
    service = module.get<UserService>(UserService);
    usersModel = module.get(getModelToken(Users.name, "Datas"));
    cacheManager = module.get<Cache>("CACHE_MANAGER");
  });
  describe("getUsers", () => {
    it("should return paginated users", async () => {
      usersModel.exec.mockResolvedValueOnce([mockUser]);
      usersModel.countDocuments.mockResolvedValueOnce(1);
      const result = await service.getUsers(1, 10);
      expect(result.items).toEqual([mockUser]);
      expect(result.totalItems).toBe(1);
    });
    it("should throw NotFoundException if no users found", async () => {
      usersModel.exec.mockResolvedValueOnce([]);
      await expect(service.getUsers(1, 10)).rejects.toThrow(NotFoundException);
    });
  });
  describe("getUserByID", () => {
    it("should return a user from cache", async () => {
      jest.spyOn(cacheManager, "get").mockResolvedValueOnce(mockUser);
      const user = await service.getUserByID(mockUser._id);
      expect(user).toEqual(mockUser);
    });
    it("should return a user from database and cache it", async () => {
      jest.spyOn(cacheManager, "get").mockResolvedValueOnce(null);
      usersModel.exec.mockResolvedValueOnce(mockUser);
      const user = await service.getUserByID(mockUser._id);
      expect(user).toEqual(mockUser);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `user_${mockUser._id}`,
        mockUser,
      );
    });
    it("should throw NotFoundException for invalid ID", async () => {
      await expect(service.getUserByID("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  describe("registerUser", () => {
    it("should create a new user", async () => {
      jest.spyOn(service as any, "emailExist").mockResolvedValue(false);
      jest.spyOn(service as any, "userNameExist").mockResolvedValue(false);
      jest.spyOn(bcrypt as any, "hash").mockResolvedValue("hashed");
      usersModel.create.mockResolvedValueOnce(mockUser);
      const result = await service.registerUser({ ...mockUser });
      expect(result).toEqual(mockUser);
    });
  });
  describe("updateUser", () => {
    it("should update user successfully", async () => {
      jest.spyOn(service, "getUserByID").mockResolvedValue(mockUser);
      usersModel.exec.mockResolvedValueOnce(mockUser);
      jest
        .spyOn(service as any, "findUser")
        .mockImplementation((user: string) => {
          if (user === "existing@example.com" || user === "existinguser") {
            return mockUser;
          }
          return null;
        });
      const updated = await service.updateUser(
        { email: "new@example.com" },
        mockUser._id,
      );
      expect(updated).toEqual(mockUser);
    });
  });
  describe("loginUser", () => {
    it("should login successfully", async () => {
      jest.spyOn(service as any, "findUser").mockResolvedValue(mockUser);
      jest.spyOn(bcrypt as any, "compare").mockResolvedValue(true);
      const result = await service.loginUser({
        user: "testuser",
        password: "pass",
      });
      expect(result).toEqual(mockUser);
    });
    it("should throw UnauthorizedException for wrong password", async () => {
      jest.spyOn(service as any, "findUser").mockResolvedValue(mockUser);
      jest.spyOn(bcrypt as any, "compare").mockResolvedValue(false);
      await expect(
        service.loginUser({ user: "testuser", password: "wrong" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      jest.spyOn(service, "loginUser").mockResolvedValue(mockUser);
      usersModel.findOneAndDelete.mockResolvedValue(mockUser);
      const result = await service.deleteUser(
        { user: "testuser", password: "pass" },
        mockUser._id,
      );
      expect(result).toEqual(mockUser);
    });
  });
  describe("private methods", () => {
    it("emailExist should throw if email exists", async () => {
      jest.spyOn(service as any, "findUser").mockResolvedValue(mockUser);
      await expect((service as any).emailExist(mockUser.email)).rejects.toThrow(
        BadRequestException,
      );
    });
    it("userNameExist should throw if username exists", async () => {
      jest.spyOn(service as any, "findUser").mockResolvedValue(mockUser);
      await expect(
        (service as any).userNameExist(mockUser.username),
      ).rejects.toThrow(BadRequestException);
    });

    it("findUser should return user", async () => {
      usersModel.exec.mockResolvedValueOnce(mockUser);
      const result = await (service as any).findUser(mockUser.email);
      expect(result).toEqual(mockUser);
    });
  });
});
