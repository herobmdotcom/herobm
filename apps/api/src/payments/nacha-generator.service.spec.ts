import { Test, TestingModule } from '@nestjs/testing';
import {
  NachaGeneratorService,
  NachaFileContext,
} from './nacha-generator.service';
import { BadRequestException } from '@nestjs/common';
import { TransactionCode } from 'nacha-cheese';

describe('NachaGeneratorService', () => {
  let service: NachaGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NachaGeneratorService],
    }).compile();

    service = module.get<NachaGeneratorService>(NachaGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid NACHA file string', () => {
    const context: NachaFileContext = {
      companyName: 'TEST PTY LTD',
      companyId: '123456789',
      immediateDestination: '122000496',
      immediateDestinationName: 'CHASE BANK',
      description: 'PAYROLL',
      processDate: new Date('2026-05-28T00:00:00Z'),
      transactions: [
        {
          routingNumber: '111000025',
          accountNumber: '12345678',
          accountName: 'JOHN DOE',
          amount: 250.75,
          reference: 'WAGES',
          transactionCode: TransactionCode.CheckingCredit,
        },
      ],
    };

    const result = service.generateNachaFile(context);
    const lines = result.split('\n');

    expect(lines.length).toBeGreaterThan(0);
    // NACHA headers start with '1'
    expect(lines[0].startsWith('1')).toBe(true);
    expect(lines[0]).toContain('CHASE BANK');
    expect(lines[0]).toContain('TEST PTY LTD');

    // Batch headers start with '5'
    expect(lines[1].startsWith('5')).toBe(true);
    expect(lines[1]).toContain('PAYROLL');

    // Entry details start with '6'
    expect(lines[2].startsWith('6')).toBe(true);
    expect(lines[2]).toContain('111000025'); // Routing number
    expect(lines[2]).toContain('JOHN DOE');
    expect(lines[2]).toContain('25075'); // Amount in cents

    // Batch controls start with '8'
    expect(lines[3].startsWith('8')).toBe(true);

    // File controls start with '9'
    expect(lines[4].startsWith('9')).toBe(true);
  });

  it('should throw BadRequestException if amount is zero or negative', () => {
    const context: NachaFileContext = {
      companyName: 'TEST PTY LTD',
      companyId: '123456789',
      immediateDestination: '122000496',
      immediateDestinationName: 'CHASE BANK',
      description: 'PAYROLL',
      processDate: new Date('2026-05-28T00:00:00Z'),
      transactions: [
        {
          routingNumber: '111000025',
          accountNumber: '12345678',
          accountName: 'JOHN DOE',
          amount: -50.0,
          reference: 'WAGES',
        },
      ],
    };

    expect(() => service.generateNachaFile(context)).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for invalid US routing lengths', () => {
    const context: NachaFileContext = {
      companyName: 'TEST PTY LTD',
      companyId: '123456789',
      immediateDestination: '122000496',
      immediateDestinationName: 'CHASE BANK',
      description: 'PAYROLL',
      processDate: new Date('2026-05-28T00:00:00Z'),
      transactions: [
        {
          routingNumber: '111000', // Only 6 digits, needs 9
          accountNumber: '12345678',
          accountName: 'JOHN DOE',
          amount: 50.0,
          reference: 'WAGES',
        },
      ],
    };

    expect(() => service.generateNachaFile(context)).toThrow(
      BadRequestException,
    );
  });
});
