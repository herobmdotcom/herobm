import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Validates that a string or number represents a percentage between 0 and 100 inclusive.
 */
export function IsPercentage(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPercentage',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} must be a valid percentage between 0 and 100`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === null || value === undefined) {
            return true;
          }
          if (typeof value !== 'string' && typeof value !== 'number') {
            return false;
          }
          const num = typeof value === 'number' ? value : parseFloat(value);
          if (isNaN(num)) {
            return false;
          }
          return num >= 0 && num <= 100;
        },
      },
    });
  };
}
