import { IsString, IsNumber, IsEnum, IsDateString, IsEmail, IsOptional, IsBoolean, IsMongoId, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, ExpenseStatus } from '@shared/lib';

export class SubmitterDto {
  @ApiProperty({
    description: 'Name of the person who submitted the expense',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address of the submitter',
    example: 'john.doe@company.com',
    format: 'email',
  })
  @IsEmail()
  email: string;
}

export class ApprovedByDto {
  @ApiProperty({
    description: 'Name of the person who approved the expense',
    example: 'Jane Smith',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address of the approver',
    example: 'jane.smith@company.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Timestamp when the expense was approved',
    example: '2024-01-20T14:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  approvedAt: string;
}

export class CreateExpenseDto {
  @ApiProperty({
    description: 'ID of the team this expense belongs to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  team: string;

  @ApiProperty({
    description: 'Description of the expense',
    example: 'Business lunch with client',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Amount of the expense in USD',
    example: 75.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Category of the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.MEALS,
  })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({
    description: 'Date when the expense was incurred',
    example: '2024-01-15',
    format: 'date',
  })
  @IsDateString()
  date: string;
  
  @ApiPropertyOptional({
    description: 'Status of the expense',
    enum: ExpenseStatus,
    example: ExpenseStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiPropertyOptional({
    description: 'Information about who submitted the expense',
    type: SubmitterDto,
  })
  @Type(() => SubmitterDto)
  @IsOptional()
  submittedBy?: SubmitterDto;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({
    description: 'Updated description of the expense',
    example: 'Updated business lunch with client',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated amount of the expense in USD',
    example: 85.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Updated category of the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.TRAVEL,
  })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Updated date when the expense was incurred',
    example: '2024-01-16',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Updated status of the expense',
    enum: ExpenseStatus,
    example: ExpenseStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiPropertyOptional({
    description: 'Information about who approved the expense',
    type: ApprovedByDto,
  })
  @IsOptional()
  @Type(() => ApprovedByDto)
  approvedBy?: ApprovedByDto;
}

export class BulkActionDto {
  @ApiProperty({
    description: 'Array of expense IDs to perform bulk action on',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String],
  })
  @IsString({ each: true })
  expenseIds: string[];

  @ApiProperty({
    description: 'Bulk action to perform on the selected expenses',
    enum: ['approve', 'reject'],
    example: 'approve',
  })
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @ApiProperty({
    description: 'Information about who is performing the bulk action',
    type: SubmitterDto,
  })
  @Type(() => SubmitterDto)
  approvedBy: SubmitterDto;
}

export class ExpenseResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the expense',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Team information (ID or populated object)',
    oneOf: [
      { type: 'string', example: '507f1f77bcf86cd799439011' },
      { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' } } }
    ],
  })
  team: string | any;

  @ApiProperty({
    description: 'Description of the expense',
    example: 'Business lunch with client',
  })
  description: string;

  @ApiProperty({
    description: 'Amount of the expense in USD',
    example: 75.50,
  })
  amount: number;

  @ApiProperty({
    description: 'Category of the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.MEALS,
  })
  category: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'AI-suggested category for the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.MEALS,
  })
  aiSuggestedCategory?: ExpenseCategory;

  @ApiProperty({
    description: 'Current status of the expense',
    enum: ExpenseStatus,
    example: ExpenseStatus.APPROVED,
  })
  status: ExpenseStatus;

  @ApiProperty({
    description: 'Information about who submitted the expense',
    type: SubmitterDto,
  })
  submittedBy: SubmitterDto;

  @ApiPropertyOptional({
    description: 'Information about who approved the expense',
    type: ApprovedByDto,
  })
  approvedBy?: ApprovedByDto;

  @ApiProperty({
    description: 'Date when the expense was incurred',
    example: '2024-01-15',
    format: 'date',
  })
  date: string;

  @ApiPropertyOptional({
    description: 'Whether this expense is flagged as a potential duplicate',
    example: false,
  })
  isDuplicate?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for duplicate detection',
    example: 'Similar amount and description found within 30 days',
  })
  duplicateReason?: string;

  @ApiProperty({
    description: 'Expense creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Expense last update timestamp',
    example: '2024-01-20T14:45:00.000Z',
  })
  updatedAt: Date;
}

export class BudgetStatusDto {
  @ApiProperty({
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  teamId: string;

  @ApiProperty({
    description: 'Team name',
    example: 'Engineering Team',
  })
  teamName: string;

  @ApiProperty({
    description: 'Total budget allocated to the team in USD',
    example: 50000,
  })
  budget: number;

  @ApiProperty({
    description: 'Current spending amount in USD',
    example: 40000,
  })
  currentSpending: number;

  @ApiProperty({
    description: 'Remaining budget amount in USD',
    example: 10000,
  })
  remainingBudget: number;

  @ApiProperty({
    description: 'Budget utilization percentage',
    example: 80.0,
  })
  utilizationPercentage: number;

  @ApiProperty({
    description: 'Whether the team has exceeded its budget',
    example: false,
  })
  isOverBudget: boolean;

  @ApiProperty({
    description: 'Whether the team is near its budget limit (80%+)',
    example: true,
  })
  isNearBudget: boolean;

  @ApiProperty({
    description: 'Status of budget alerts sent',
    example: {
      eightyPercentSent: true,
      hundredPercentSent: false,
    },
  })
  alertStatus: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };
}

export class SpendingInsightsDto {
  @ApiProperty({
    description: 'AI-generated summary of spending patterns',
    example: 'Your team has spent $25,000 this quarter, with travel being the highest category at 40%.',
  })
  summary: string;

  @ApiProperty({
    description: 'Category with the highest spending',
    example: 'Travel',
  })
  topCategory: string;

  @ApiProperty({
    description: 'AI-generated analysis of spending trends',
    example: 'Spending has increased 15% compared to last quarter, primarily due to increased travel expenses.',
  })
  trends: string;

  @ApiProperty({
    description: 'AI-generated recommendations for budget optimization',
    example: ['Consider virtual meetings to reduce travel costs', 'Negotiate better rates with preferred vendors'],
    type: [String],
  })
  recommendations: string[];

  @ApiProperty({
    description: 'Overall budget health assessment',
    example: 'Good - On track to stay within budget with current spending patterns.',
  })
  budgetHealth: string;

  @ApiProperty({
    description: 'Total amount spent in USD',
    example: 25000,
  })
  totalSpent: number;

  @ApiProperty({
    description: 'Budget utilization percentage',
    example: 50.0,
  })
  budgetUtilization: number;

  @ApiProperty({
    description: 'Breakdown of spending by category',
    example: {
      'Travel': 10000,
      'Meals': 5000,
      'Equipment': 7000,
      'Other': 3000
    },
  })
  categoryBreakdown: Record<string, number>;
}

export class BudgetForecastDto {
  @ApiProperty({
    description: 'Whether the team is predicted to exceed its budget',
    example: false,
  })
  willExceedBudget: boolean;

  @ApiProperty({
    description: 'Confidence level of the forecast (0-100)',
    example: 85.5,
  })
  confidence: number;

  @ApiProperty({
    description: 'Predicted amount of overspend in USD (if applicable)',
    example: 0,
  })
  predictedOverspend: number;

  @ApiProperty({
    description: 'Number of months until budget is exceeded (if applicable)',
    example: 0,
  })
  monthsToExceed: number;

  @ApiProperty({
    description: 'AI-generated recommendations to avoid budget overrun',
    example: ['Reduce travel expenses by 20%', 'Defer non-essential equipment purchases'],
    type: [String],
  })
  recommendations: string[];

  @ApiProperty({
    description: 'Average monthly spending amount in USD',
    example: 8333.33,
  })
  averageMonthlySpending: number;

  @ApiProperty({
    description: 'Current budget utilization percentage',
    example: 50.0,
  })
  currentUtilization: number;
}
