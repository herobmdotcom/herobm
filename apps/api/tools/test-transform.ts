const { validateSync, IsNumberString, IsOptional } = require('class-validator');
const { plainToInstance, Transform } = require('class-transformer');

class MyDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : String(value)))
  @IsNumberString()
  field;
}

const obj = { field: 10 };
const instance = plainToInstance(MyDto, obj);
const errors = validateSync(instance);
console.log('Value sent as number 10:', errors.length ? errors[0].constraints : 'success', instance.field);

const obj2 = { field: null };
const instance2 = plainToInstance(MyDto, obj2);
const errors2 = validateSync(instance2);
console.log('Value sent as null:', errors2.length ? errors2[0].constraints : 'success', instance2.field);
