import { FieldMaskInterceptor } from './field-mask.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('FieldMaskInterceptor', () => {
  let interceptor: FieldMaskInterceptor;

  beforeEach(() => {
    interceptor = new FieldMaskInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should return original data if no fields query parameter is provided', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ query: {} }),
      }),
    } as ExecutionContext;

    const next = {
      handle: () => of({ id: 1, name: 'Test', metadata: 'hidden' }),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ id: 1, name: 'Test', metadata: 'hidden' });
      done();
    });
  });

  it('should filter fields correctly for a single object', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ query: { fields: 'id,name' } }),
      }),
    } as ExecutionContext;

    const next = {
      handle: () => of({ id: 1, name: 'Test', metadata: 'hidden' }),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ id: 1, name: 'Test' });
      done();
    });
  });

  it('should filter fields correctly for an array of objects', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ query: { fields: 'name' } }),
      }),
    } as ExecutionContext;

    const next = {
      handle: () =>
        of([
          { id: 1, name: 'A', metadata: 's1' },
          { id: 2, name: 'B', metadata: 's2' },
        ]),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual([{ name: 'A' }, { name: 'B' }]);
      done();
    });
  });

  it('should filter fields correctly for a paginated response wrapper', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ query: { fields: 'id' } }),
      }),
    } as ExecutionContext;

    const next = {
      handle: () =>
        of({
          data: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
          ],
          total: 2,
        }),
    } as CallHandler;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        data: [{ id: 1 }, { id: 2 }],
        total: 2,
      });
      done();
    });
  });
});
