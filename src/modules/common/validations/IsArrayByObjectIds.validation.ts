import {
  registerDecorator,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationOptions,
} from "class-validator";
import { CommonService } from "../services/common.service";

@ValidatorConstraint({ name: "IsObjectId", async: false })
export class IsArryByObjectIdsValidation
  implements ValidatorConstraintInterface
{
  constructor(private readonly commonService: CommonService) {}

  defaultMessage(validationArguments?: ValidationArguments): string {
    return `${validationArguments?.property} is not a valid Array of ObjectIds`;
  }

  validate(value: [string]): boolean {
    return this.commonService.validateArryByMongoIDs(value);
  }
}

export const IsArryByObjectIds = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsArryByObjectIdsValidation,
    });
  };
};
