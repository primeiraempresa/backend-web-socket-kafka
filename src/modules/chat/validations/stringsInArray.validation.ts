import { Injectable, Logger } from "@nestjs/common";
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "StringsInArray", async: false })
@Injectable()
export class StringsInArrayValidation implements ValidatorConstraintInterface {
  defaultMessage(validationArguments?: ValidationArguments): string {
    return `strings inside the ${validationArguments?.property} field's carrey array are empty`;
  }
  validate(value: string[]): boolean {
    for (const item of value) {
      if (!item) {
        return false;
      }
    }
    return true;
  }
}
export const StringsInArray = (opcoesDeValidacao?: ValidationOptions) => {
  return (objeto: object, propriedade: string) => {
    registerDecorator({
      target: objeto.constructor,
      propertyName: propriedade,
      options: opcoesDeValidacao,
      constraints: [],
      validator: StringsInArrayValidation,
    });
  };
};
