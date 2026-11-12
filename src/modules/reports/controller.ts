import { Request, Response } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { ROLES } from '../../constants/roles';
import { ForbiddenError } from '../../errors';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { buildCsvBuffer, buildExcelBuffer, buildPdfBuffer } from './export';
import { reportsService } from './service';
import { ReportFilterInput, ReportFormat, ReportTableResult } from './types';

function assertCanExport(req: Request, format: ReportFormat) {
  if (format === 'json') return;

  const user = req.user;
  if (!user) throw new ForbiddenError('Authentication required');

  const isAdmin =
    user.roleSlug === ROLES.SUPER_ADMIN || user.roleSlug === 'super_admin';
  const hasExportPerm = (user.permissions || []).includes(PERMISSIONS.REPORTS_EXPORT);

  if (!isAdmin && !hasExportPerm) {
    throw new ForbiddenError(
      `Insufficient permissions to export reports (${PERMISSIONS.REPORTS_EXPORT})`
    );
  }
}

export class ReportsController {
  private buildFilter(req: Request): ReportFilterInput {
    const format = (req.query.format as ReportFormat) || 'json';
    assertCanExport(req, format);
    return {
      branchId: resolveBranchScope(req),
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      format,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    };
  }

  private async respond(
    req: Request,
    res: Response,
    report: ReportTableResult,
    format: ReportFormat = 'json'
  ) {
    assertCanExport(req, format);

    if (format === 'csv') {
      const csvBuffer = buildCsvBuffer(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.filename}.csv"`
      );
      return res.status(200).send(csvBuffer);
    }

    if (format === 'excel') {
      const excelBuffer = await buildExcelBuffer(report);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.filename}.xlsx"`
      );
      return res.status(200).send(excelBuffer);
    }

    if (format === 'pdf') {
      const pdfBuffer = await buildPdfBuffer(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.filename}.pdf"`
      );
      return res.status(200).send(pdfBuffer);
    }

    return sendSuccess(res, report, `${report.title} generated successfully`);
  }

  async salesByItem(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getSalesByItem(filter);
    return this.respond(req, res, report, filter.format);
  }

  async salesByCategory(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getSalesByCategory(filter);
    return this.respond(req, res, report, filter.format);
  }

  async salesByStaff(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getSalesByStaff(filter);
    return this.respond(req, res, report, filter.format);
  }

  async salesByPayment(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getSalesByPayment(filter);
    return this.respond(req, res, report, filter.format);
  }

  async salesByTime(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getSalesByTime(filter);
    return this.respond(req, res, report, filter.format);
  }

  async inventoryValuation(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getInventoryValuation(filter);
    return this.respond(req, res, report, filter.format);
  }

  async wastage(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getWastageReport(filter);
    return this.respond(req, res, report, filter.format);
  }

  async customerRetention(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getCustomerRetentionReport(filter);
    return this.respond(req, res, report, filter.format);
  }

  async discountUsage(req: Request, res: Response) {
    const filter = this.buildFilter(req);
    const report = await reportsService.getDiscountUsageReport(filter);
    return this.respond(req, res, report, filter.format);
  }
}

export const reportsController = new ReportsController();

