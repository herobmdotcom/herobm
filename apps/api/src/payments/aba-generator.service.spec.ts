import { Test, TestingModule } from '@nestjs/testing';
import { AbaGeneratorService, AbaFileContext } from './aba-generator.service';
import { BadRequestException } from '@nestjs/common';

describe('AbaGeneratorService', () => {
  let service: AbaGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbaGeneratorService],
    }).compile();

    service = module.get<AbaGeneratorService>(AbaGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid ABA file string with correct padding', () => {
    const context: AbaFileContext = {
      bankName: 'CBA',
      abaUserName: 'TEST PTY LTD',
      abaUserId: '123456',
      description: 'PAYROLL',
      processDate: '230526',
      transactions: [
        {
          bsb: '062-000',
          accountNumber: '12345678',
          accountName: 'JOHN DOE',
          amount: 250.75, // 25075 cents
          traceBsb: '062-111',
          traceAccountNumber: '87654321',
          remitterName: 'TEST PTY LTD',
          reference: 'WAGES',
        },
      ],
    };

    const result = service.generateAbaFile(context);
    const lines = result.split('\r\n');

    expect(lines).toHaveLength(3);

    // Check Descriptive Record (0)
    expect(lines[0]).toHaveLength(120);
    expect(lines[0].substring(0, 1)).toBe('0');
    expect(lines[0].substring(18, 20)).toBe('01');
    expect(lines[0].substring(20, 23)).toBe('CBA');
    expect(lines[0].substring(30, 56).trim()).toBe('TEST PTY LTD');
    expect(lines[0].substring(56, 62)).toBe('123456');
    expect(lines[0].substring(62, 74).trim()).toBe('PAYROLL');
    expect(lines[0].substring(74, 80)).toBe('230526');

    // Check Detail Record (1)
    expect(lines[1]).toHaveLength(120);
    expect(lines[1].substring(0, 1)).toBe('1');
    expect(lines[1].substring(1, 8)).toBe('062-000');
    expect(lines[1].substring(8, 17).trim()).toBe('12345678');
    expect(lines[1].substring(18, 20)).toBe('53');
    expect(lines[1].substring(20, 30)).toBe('0000025075'); // 250.75 padded to 10 with leading zeros
    expect(lines[1].substring(30, 62).trim()).toBe('JOHN DOE');
    expect(lines[1].substring(62, 80).trim()).toBe('WAGES');
    expect(lines[1].substring(80, 87)).toBe('062-111');
    expect(lines[1].substring(87, 96).trim()).toBe('87654321');
    expect(lines[1].substring(96, 112).trim()).toBe('TEST PTY LTD');

    // Check File Total Record (7)
    expect(lines[2]).toHaveLength(120);
    expect(lines[2].substring(0, 1)).toBe('7');
    expect(lines[2].substring(1, 8)).toBe('999-999');
    expect(lines[2].substring(20, 30)).toBe('0000025075'); // Net Total
    expect(lines[2].substring(30, 40)).toBe('0000025075'); // Credit Total
    expect(lines[2].substring(40, 50)).toBe('0000000000'); // Debit Total
    expect(lines[2].substring(74, 80)).toBe('000001'); // 1 Record
  });

  it('should sanitize non-ASCII characters and truncate correctly', () => {
    const context: AbaFileContext = {
      bankName: 'NAB',
      abaUserName: 'TEST & CO! ✨', // Special chars
      abaUserId: '123',
      description: 'LONG DESC THAT WILL BE TRUNCATED',
      processDate: '230526',
      transactions: [
        {
          bsb: '083000', // Missing dash, should be auto-formatted
          accountNumber: '111',
          accountName: 'JØHN DÖE',
          amount: 100.0,
          traceBsb: '083-111',
          traceAccountNumber: '222',
          remitterName: 'TEST',
          reference: 'REF',
        },
      ],
    };

    const result = service.generateAbaFile(context);
    const lines = result.split('\r\n');

    // Name sanitization (non-ascii removed, punctuation kept if ascii)
    // Actually the padStr removes non \x00-\x7F so "JØHN DÖE" -> "JHN DE"
    expect(lines[1].substring(30, 62).trim()).toBe('JHN DE');

    // BSB formatting from 083000 to 083-000
    expect(lines[1].substring(1, 8)).toBe('083-000');

    // Description truncation to 12 chars
    expect(lines[0].substring(62, 74)).toBe('LONG DESC TH');
  });

  it('should throw BadRequestException if amount is negative or zero', () => {
    const context: AbaFileContext = {
      bankName: 'NAB',
      abaUserName: 'TEST',
      abaUserId: '123456',
      description: 'PAY',
      processDate: '230526',
      transactions: [
        {
          bsb: '083-000',
          accountNumber: '111',
          accountName: 'DOE',
          amount: -50,
          traceBsb: '083-000',
          traceAccountNumber: '222',
          remitterName: 'TEST',
          reference: 'REF',
        },
      ],
    };

    expect(() => service.generateAbaFile(context)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid BSB lengths', () => {
    const context: AbaFileContext = {
      bankName: 'NAB',
      abaUserName: 'TEST',
      abaUserId: '123456',
      description: 'PAY',
      processDate: '230526',
      transactions: [
        {
          bsb: '083',
          accountNumber: '111',
          accountName: 'DOE',
          amount: 50,
          traceBsb: '083-000',
          traceAccountNumber: '222',
          remitterName: 'TEST',
          reference: 'REF',
        },
      ],
    };

    expect(() => service.generateAbaFile(context)).toThrow(BadRequestException);
  });
});
