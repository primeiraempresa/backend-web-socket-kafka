import {
  registerDecorator,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationOptions,
} from "class-validator";
import { CommonService } from "../services/common.service";

@ValidatorConstraint({ name: "IsObjectId", async: false })
export class IsObjectIdValidation implements ValidatorConstraintInterface {
  constructor(private readonly commonService: CommonService) {}

  defaultMessage(validationArguments?: ValidationArguments): string {
    return `${validationArguments?.property} is not a valid ObjectId`;
  }

  validate(value: string): boolean {
    return this.commonService.validateMongoID(value);
  }
}

export const IsObjectId = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsObjectIdValidation,
    });
  };
};
