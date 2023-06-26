import { Test, TestingModule } from '@nestjs/testing';
import { UpdatedDateService } from './updated-date.service';
import { ConfigModule } from '@nestjs/config';

describe('UpdatedDateService', () => {
  let service: UpdatedDateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [UpdatedDateService],
    }).compile();

    service = module.get<UpdatedDateService>(UpdatedDateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
