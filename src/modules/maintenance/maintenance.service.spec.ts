import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

const mockPrisma = {
  maintenanceWindow: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  maintenanceMonitor: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };

const makeWindow = (overrides = {}) => ({
  id: 1,
  userId: 10,
  title: 'Nightly Maintenance',
  strategy: 'manual' as const,
  active: true,
  startDate: null,
  endDate: null,
  weekdays: [],
  hours: [],
  durationMinutes: 60,
  cronExpr: null,
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
  monitors: [],
  ...overrides,
});

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns maintenance windows for user', async () => {
      mockPrisma.maintenanceWindow.findMany.mockResolvedValue([makeWindow()]);
      const result = await service.findAll(10);
      expect(result).toHaveLength(1);
      expect(result[0].monitorIds).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns window for correct owner', async () => {
      mockPrisma.maintenanceWindow.findUnique.mockResolvedValue(makeWindow());
      const result = await service.findOne(1, 10);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.maintenanceWindow.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.maintenanceWindow.findUnique.mockResolvedValue(makeWindow({ userId: 99 }));
      await expect(service.findOne(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates maintenance window with monitor associations', async () => {
      const created = makeWindow({ monitors: [{ monitorId: 5 }] });
      mockPrisma.maintenanceWindow.create.mockResolvedValue(created);

      const result = await service.create(10, {
        title: 'Nightly Maintenance',
        strategy: 'manual',
        monitorIds: [5],
      }, '127.0.0.1');

      expect(mockPrisma.maintenanceWindow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 10,
            title: 'Nightly Maintenance',
          }),
        }),
      );
      expect(result.monitorIds).toEqual([5]);
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance.create' }));
    });
  });

  describe('delete', () => {
    it('deletes window and logs audit', async () => {
      mockPrisma.maintenanceWindow.findUnique.mockResolvedValue(makeWindow());
      mockPrisma.maintenanceWindow.delete.mockResolvedValue({});
      await service.delete(1, 10, '127.0.0.1');
      expect(mockPrisma.maintenanceWindow.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance.delete' }));
    });
  });

  describe('isWindowActive', () => {
    // Use local-time constructor so getDay()/getHours()/getDate() return predictable values
    // Jan 15, 2024 at 10:00 local — this is a Monday
    const now = new Date(2024, 0, 15, 10, 0, 0); // local time: Mon Jan 15 10:00

    describe('manual strategy', () => {
      it('returns true when active=true', () => {
        expect(service.isWindowActive(makeWindow({ strategy: 'manual', active: true }), now)).toBe(true);
      });

      it('returns false when active=false', () => {
        expect(service.isWindowActive(makeWindow({ strategy: 'manual', active: false }), now)).toBe(false);
      });
    });

    describe('one-time strategy', () => {
      it('returns true when now is within range', () => {
        const window = makeWindow({
          strategy: 'one-time',
          startDate: new Date(2024, 0, 14, 0, 0, 0),
          endDate: new Date(2024, 0, 16, 0, 0, 0),
        });
        expect(service.isWindowActive(window, now)).toBe(true);
      });

      it('returns false when now is after endDate', () => {
        const window = makeWindow({
          strategy: 'one-time',
          startDate: new Date(2024, 0, 10, 0, 0, 0),
          endDate: new Date(2024, 0, 12, 0, 0, 0),
        });
        expect(service.isWindowActive(window, now)).toBe(false);
      });

      it('returns false when now is before startDate', () => {
        const window = makeWindow({
          strategy: 'one-time',
          startDate: new Date(2024, 0, 16, 0, 0, 0),
          endDate: new Date(2024, 0, 17, 0, 0, 0),
        });
        expect(service.isWindowActive(window, now)).toBe(false);
      });

      it('returns true when no endDate and now is after startDate', () => {
        const window = makeWindow({
          strategy: 'one-time',
          startDate: new Date(2024, 0, 1, 0, 0, 0),
          endDate: null,
        });
        expect(service.isWindowActive(window, now)).toBe(true);
      });

      it('returns false when no startDate and no endDate', () => {
        const window = makeWindow({ strategy: 'one-time', startDate: null, endDate: null });
        expect(service.isWindowActive(window, now)).toBe(false);
      });
    });

    describe('recurring-interval / recurring-weekday strategy', () => {
      it('returns true when weekday and hour match', () => {
        // now.getDay() = 1 (Monday), now.getHours() = 10
        const window = makeWindow({
          strategy: 'recurring-weekday',
          weekdays: [now.getDay()],
          hours: [now.getHours()],
        });
        expect(service.isWindowActive(window, now)).toBe(true);
      });

      it('returns false when weekday does not match', () => {
        const nonMatchingDay = now.getDay() === 2 ? 3 : 2;
        const window = makeWindow({
          strategy: 'recurring-weekday',
          weekdays: [nonMatchingDay],
          hours: [now.getHours()],
        });
        expect(service.isWindowActive(window, now)).toBe(false);
      });

      it('returns false when hour does not match', () => {
        const nonMatchingHour = now.getHours() === 22 ? 23 : 22;
        const window = makeWindow({
          strategy: 'recurring-weekday',
          weekdays: [now.getDay()],
          hours: [nonMatchingHour],
        });
        expect(service.isWindowActive(window, now)).toBe(false);
      });

      it('returns true when empty weekdays/hours (matches any)', () => {
        const window = makeWindow({
          strategy: 'recurring-interval',
          weekdays: [],
          hours: [],
        });
        expect(service.isWindowActive(window, now)).toBe(true);
      });
    });

    describe('recurring-day-of-month strategy', () => {
      it('returns true when day of month and hour match', () => {
        // now.getDate() = 15, now.getHours() = 10
        const window = makeWindow({
          strategy: 'recurring-day-of-month',
          weekdays: [now.getDate()], // repurposed as DOM
          hours: [now.getHours()],
        });
        expect(service.isWindowActive(window, now)).toBe(true);
      });

      it('returns false when day of month does not match', () => {
        const nonMatchingDom = now.getDate() === 1 ? 2 : 1;
        const window = makeWindow({
          strategy: 'recurring-day-of-month',
          weekdays: [nonMatchingDom],
          hours: [now.getHours()],
        });
        expect(service.isWindowActive(window, now)).toBe(false);
      });
    });

    describe('cron strategy', () => {
      it('returns true when cron fires every minute (always active)', () => {
        // '* * * * *' fires every minute — prev was < 60s ago, duration=1min
        const realNow = new Date();
        const window = makeWindow({
          strategy: 'cron',
          cronExpr: '* * * * *',
          durationMinutes: 1,
          timezone: 'UTC',
        });
        expect(service.isWindowActive(window, realNow)).toBe(true);
      });

      it('returns false when cron only fires once a year with 1 min duration', () => {
        // '0 0 29 2 *' fires Feb 29 (leap day) — very unlikely to have fired within 1 min
        const realNow = new Date();
        const window = makeWindow({
          strategy: 'cron',
          cronExpr: '0 0 29 2 *',
          durationMinutes: 1,
          timezone: 'UTC',
        });
        // Unlikely to be active unless today is literally Feb 29 at midnight
        const result = service.isWindowActive(window, realNow);
        const isLeapDay = realNow.getMonth() === 1 && realNow.getDate() === 29 &&
          Math.abs(realNow.getHours() * 60 + realNow.getMinutes()) < 1;
        expect(result).toBe(isLeapDay);
      });

      it('returns false for invalid cron expression', () => {
        const window = makeWindow({
          strategy: 'cron',
          cronExpr: 'not-a-cron',
          durationMinutes: 60,
        });
        expect(service.isWindowActive(window, new Date())).toBe(false);
      });

      it('returns false when cronExpr is null', () => {
        const window = makeWindow({ strategy: 'cron', cronExpr: null });
        expect(service.isWindowActive(window, new Date())).toBe(false);
      });
    });

    describe('unknown strategy', () => {
      it('returns false for unknown strategy', () => {
        const window = makeWindow({ strategy: 'unknown-strategy' });
        expect(service.isWindowActive(window, now)).toBe(false);
      });
    });
  });
});
