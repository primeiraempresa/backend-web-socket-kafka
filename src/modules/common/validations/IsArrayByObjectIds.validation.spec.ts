import { IsArryByObjectIdsValidation } from "./IsArrayByObjectIds.validation";
import { CommonService } from "../services/common.service";

describe("IsArryByObjectIdsValidation", () => {
  let validator: IsArryByObjectIdsValidation;
  let commonService: CommonService;

  beforeEach(() => {
    commonService = {
      validateArryByMongoIDs: jest.fn(),
    } as any;

    validator = new IsArryByObjectIdsValidation(commonService);
  });

  it("should return true if array contains valid ObjectIds", () => {
    const validObjectIds = [
      "60b8d295f8d3c436a8d2b556",
      "507f1f77bcf86cd799439011",
    ];
    (commonService.validateArryByMongoIDs as jest.Mock).mockReturnValue(true);

    const result = validator.validate(validObjectIds);
    expect(result).toBe(true);
    expect(commonService.validateArryByMongoIDs).toHaveBeenCalledWith(
      validObjectIds,
    );
  });

  it("should return false if array contains invalid ObjectIds", () => {
    const invalidObjectIds = ["invalid-id", "another-invalid-id"];
    (commonService.validateArryByMongoIDs as jest.Mock).mockReturnValue(false);

    const result = validator.validate(invalidObjectIds);
    expect(result).toBe(false);
    expect(commonService.validateArryByMongoIDs).toHaveBeenCalledWith(
      invalidObjectIds,
    );
  });

  it("should return correct default error message", () => {
    const message = validator.defaultMessage({ property: "ids" } as any);
    expect(message).toBe("ids is not a valid Array of ObjectIds");
  });
});
