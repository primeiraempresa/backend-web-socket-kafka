// is-object-id.validation.spec.ts
import { IsObjectIdValidation } from "./IsObjctId.validation";
import { CommonService } from "../services/common.service";

describe("IsObjectIdValidation", () => {
  let validator: IsObjectIdValidation;
  let commonService: CommonService;

  beforeEach(() => {
    commonService = {
      validateMongoID: jest.fn(),
    } as any;
    validator = new IsObjectIdValidation(commonService);
  });

  it("should return true for a valid MongoID", () => {
    const validMongoID = "60b8d295f8d3c436a8d2b556";
    (commonService.validateMongoID as jest.Mock).mockReturnValue(true);

    const result = validator.validate(validMongoID);
    expect(result).toBe(true);
    expect(commonService.validateMongoID).toHaveBeenCalledWith(validMongoID);
  });

  it("should return false for an invalid MongoID", () => {
    const invalidMongoID = "invalid-id";
    (commonService.validateMongoID as jest.Mock).mockReturnValue(false);

    const result = validator.validate(invalidMongoID);
    expect(result).toBe(false);
    expect(commonService.validateMongoID).toHaveBeenCalledWith(invalidMongoID);
  });

  it("should return correct default error message", () => {
    const message = validator.defaultMessage({ property: "userId" } as any);
    expect(message).toBe("userId is not a valid ObjectId");
  });
});
