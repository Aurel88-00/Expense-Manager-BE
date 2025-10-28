import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { format } from 'date-fns';
import { ExpenseService } from '../services/expense.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  BulkActionDto,
} from '../dto/expense.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('expenses')
export class ExpenseController {
  private readonly logger = new Logger(ExpenseController.name);

  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  async create(@Body() createExpenseDto: CreateExpenseDto) {
    try {
      const result = await this.expenseService.create(createExpenseDto);
      return {
        success: true,
        expense: result.expense,
        aiSuggestion: result.aiSuggestion,
        duplicateWarning: result.duplicateWarning,
      };
    } catch (error) {
      this.logger.error(
        `Error creating expense: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to create expense',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(@Query() query: any) {
    try {
      const result = await this.expenseService.findAll(query);
      return {
        success: true,
        expenses: result.expenses,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching expenses: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to fetch expenses',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const expense = await this.expenseService.findOne(id);
      return {
        success: true,
        expense,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching expense ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to fetch expense',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    try {
      const expense = await this.expenseService.update(id, updateExpenseDto);
      return {
        success: true,
        expense,
      };
    } catch (error) {
      this.logger.error(
        `Error updating expense ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to update expense',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.expenseService.remove(id);
      return {
        success: true,
        message: 'Expense deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error deleting expense ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to delete expense',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':teamId/insights')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) 
  async getInsights(@Param('teamId') teamId: string) {
    try {
      const insights = await this.expenseService.getInsights(teamId);
      return {
        success: true,
        insights,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('temporarily unavailable')) {
        this.logger.warn(`AI service rate limited for insights request (team ${teamId})`);
        return {
          success: false,
          message: 'AI insights temporarily unavailable due to rate limits. Please try again in a moment.',
          insights: null,
        };
      }
      
      this.logger.error(`Error fetching insights for team ${teamId}: ${errorMessage}`);
      throw new HttpException(
        {
          success: false,
          message: errorMessage || 'Failed to fetch insights',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':teamId/forecast')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) 
  async getForecast(@Param('teamId') teamId: string) {
    try {
      const forecast = await this.expenseService.getForecast(teamId);
      return {
        success: true,
        forecast,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('temporarily unavailable')) {
        this.logger.warn(`AI service rate limited for forecast request (team ${teamId})`);
        return {
          success: false,
          message: 'AI forecast temporarily unavailable due to rate limits. Please try again in a moment.',
          forecast: null,
        };
      }
      
      this.logger.error(`Error fetching forecast for team ${teamId}: ${errorMessage}`);
      throw new HttpException(
        {
          success: false,
          message: errorMessage || 'Failed to fetch forecast',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk-action')
  async bulkAction(@Body() bulkActionDto: BulkActionDto) {
    try {
      const result = await this.expenseService.bulkAction(bulkActionDto);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Error performing bulk action: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to perform bulk action',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export-pdf')
  async exportPdf(@Body() filters: any, @Res() res: Response): Promise<void> {
    try {
      const buffer = await this.expenseService.exportPdf(filters);
      const filename = `Expense_Report_${format(new Date(), 'yyyyMMdd')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export PDF';
      this.logger.error(`Error exporting PDF: ${message}`);
      throw new HttpException(
        { success: false, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
