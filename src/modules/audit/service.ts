import { logger } from '../../config/logger';
import { NotFoundError } from '../../errors';
import { auditRepository } from './repository';
import { AuditLogFilterQuery, CreateAuditLogInput } from './types';

export class AuditService {
  /**
   * Records a security or operational audit log entry without blocking main business flow if logging fails.
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await auditRepository.create(input);
    } catch (error) {
      logger.warn({ err: error, auditInput: input.action }, 'Failed to write audit log entry');
    }
  }

  async listLogs(query: AuditLogFilterQuery) {
    return auditRepository.findMany(query);
  }

  async getLogById(id: string) {
    const log = await auditRepository.findById(id);
    if (!log) {
      throw new NotFoundError('Audit log');
    }
    return log;
  }
}

export const auditService = new AuditService();

