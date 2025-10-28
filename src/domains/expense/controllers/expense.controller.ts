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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ExpenseService } from '../services/expense.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  BulkActionDto,
  ExpenseResponseDto,
  SpendingInsightsDto,
  BudgetForecastDto,
} from '../dto/expense.dto';
import { ApiResponseDto, PaginatedResponseDto } from '../../../shared/dto/api-response.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Expenses')
@Controller('expenses')
export class ExpenseController {
  private readonly logger = new Logger(ExpenseController.name);

  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new expense',
    description: 'Creates a new expense with AI-powered category suggestion and duplicate detection. The system will automatically suggest categories and check for potential duplicates.',
  })
  @ApiBody({
    type: CreateExpenseDto,
    description: 'Expense creation data',
  })
  @ApiCreatedResponse({
    description: 'Expense created successfully',
    schema: {
      example: {
        success: true,
        expense: {
          _id: '507f1f77bcf86cd799439011',
          team: '507f1f77bcf86cd799439012',
          description: 'Business lunch with client',
          amount: 75.50,
          category: 'Meals',
          status: 'pending',
          submittedBy: {
            name: 'John Doe',
            email: 'john.doe@company.com'
          },
          date: '2024-01-15',
          isDuplicate: false,
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        },
        aiSuggestion: {
          category: 'Meals',
          confidence: 0.95
        },
        duplicateWarning: null
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or team not found',
    schema: {
      example: {
        success: false,
        message: 'Team not found'
      }
    }
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Get all expenses',
    description: 'Retrieves a paginated list of expenses with optional filtering by team, status, category, date range, and search terms.',
  })
  @ApiQuery({
    name: 'team',
    description: 'Filter by team ID',
    required: false,
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by expense status',
    required: false,
    enum: ['pending', 'approved', 'rejected'],
    example: 'approved',
  })
  @ApiQuery({
    name: 'category',
    description: 'Filter by expense category',
    required: false,
    example: 'Travel',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Filter expenses from this date (YYYY-MM-DD)',
    required: false,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Filter expenses until this date (YYYY-MM-DD)',
    required: false,
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'search',
    description: 'Search in description and category',
    required: false,
    example: 'lunch',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of expenses per page',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['date', 'amount', 'createdAt'],
    example: 'date',
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiOkResponse({
    description: 'Expenses retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Get expense by ID',
    description: 'Retrieves a specific expense by its ID with populated team information.',
  })
  @ApiParam({
    name: 'id',
    description: 'Expense ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Expense retrieved successfully',
    type: ApiResponseDto<ExpenseResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'Expense not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Update expense',
    description: 'Updates an existing expense. When status is changed to approved/rejected, team spending is automatically updated and email notifications are sent.',
  })
  @ApiParam({
    name: 'id',
    description: 'Expense ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    type: UpdateExpenseDto,
    description: 'Updated expense data',
  })
  @ApiOkResponse({
    description: 'Expense updated successfully',
    type: ApiResponseDto<ExpenseResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'Expense not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Delete expense',
    description: 'Deletes an expense. If the expense was approved, it will be subtracted from the team\'s current spending.',
  })
  @ApiParam({
    name: 'id',
    description: 'Expense ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Expense deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Expense deleted successfully'
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Expense not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Get AI spending insights',
    description: 'Generates AI-powered spending insights for a team including summary, trends, recommendations, and budget health analysis. Results are cached for 5 minutes.',
  })
  @ApiParam({
    name: 'teamId',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Insights generated successfully',
    type: ApiResponseDto<SpendingInsightsDto>,
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or AI service unavailable',
  })
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
  @ApiOperation({
    summary: 'Get AI budget forecast',
    description: 'Generates AI-powered budget forecast for a team predicting whether they will exceed their budget and providing recommendations. Results are cached for 5 minutes.',
  })
  @ApiParam({
    name: 'teamId',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Forecast generated successfully',
    type: ApiResponseDto<BudgetForecastDto>,
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or AI service unavailable',
  })
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
  @ApiOperation({
    summary: 'Bulk approve/reject expenses',
    description: 'Performs bulk approval or rejection of multiple expenses. Updates team spending and sends email notifications for each expense.',
  })
  @ApiBody({
    type: BulkActionDto,
    description: 'Bulk action data including expense IDs and action type',
  })
  @ApiOkResponse({
    description: 'Bulk action completed successfully',
    schema: {
      example: {
        success: true,
        message: '5 expenses approved successfully',
        updatedCount: 5
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or some expenses not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
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

 
}
