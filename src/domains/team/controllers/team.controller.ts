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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TeamService } from '../services/team.service';
import { CreateTeamDto, UpdateTeamDto, TeamResponseDto } from '../dto/team.dto';
import { ApiResponseDto, PaginatedResponseDto } from '../../../shared/dto/api-response.dto';

@ApiTags('Teams')
@Controller('teams')
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new team',
    description: 'Creates a new team with specified budget and members. Team names must be unique.',
  })
  @ApiBody({
    type: CreateTeamDto,
    description: 'Team creation data including name, budget, and members',
  })
  @ApiCreatedResponse({
    description: 'Team created successfully',
    type: ApiResponseDto<TeamResponseDto>,
    schema: {
      example: {
        success: true,
        team: {
          _id: '507f1f77bcf86cd799439011',
          name: 'Engineering Team',
          budget: 50000,
          currentSpending: 0,
          members: [
            {
              name: 'John Doe',
              email: 'john.doe@company.com',
              role: 'member'
            }
          ],
          budgetAlerts: {
            eightyPercentSent: false,
            hundredPercentSent: false
          },
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or team name already exists',
    schema: {
      example: {
        success: false,
        message: 'Team name already exists'
      }
    }
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    schema: {
      example: {
        success: false,
        message: 'Failed to create team'
      }
    }
  })
  async create(@Body() createTeamDto: CreateTeamDto) {
    try {
      const team = await this.teamService.create(createTeamDto);
      return {
        success: true,
        team,
      };
    } catch (error) {
      this.logger.error(
        `Error creating team: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to create team',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all teams',
    description: 'Retrieves a list of all teams with their budget information and current spending. Automatically checks and sends budget alerts if thresholds are exceeded.',
  })
  @ApiOkResponse({
    description: 'Teams retrieved successfully',
    type: ApiResponseDto<TeamResponseDto[]>,
    schema: {
      example: {
        success: true,
        teams: [
          {
            _id: '507f1f77bcf86cd799439011',
            name: 'Engineering Team',
            budget: 50000,
            currentSpending: 25000,
            members: [
              {
                name: 'John Doe',
                email: 'john.doe@company.com',
                role: 'member'
              }
            ],
            budgetAlerts: {
              eightyPercentSent: false,
              hundredPercentSent: false
            },
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-20T14:45:00.000Z'
          }
        ]
      }
    }
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    schema: {
      example: {
        success: false,
        message: 'Failed to fetch teams'
      }
    }
  })
  async findAll() {
    try {
      const teams = await this.teamService.findAll();
      return {
        success: true,
        teams,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching teams: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to fetch teams',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get team by ID',
    description: 'Retrieves a specific team by its ID with updated current spending calculation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Team retrieved successfully',
    type: ApiResponseDto<TeamResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
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
  async findOne(@Param('id') id: string) {
    try {
      const team = await this.teamService.findOne(id);
      return {
        success: true,
        team,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching team ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to fetch team',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update team',
    description: 'Updates an existing team. Team name must be unique if changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({
    type: UpdateTeamDto,
    description: 'Updated team data',
  })
  @ApiOkResponse({
    description: 'Team updated successfully',
    type: ApiResponseDto<TeamResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or team name already exists',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  async update(@Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto) {
    try {
      const team = await this.teamService.update(id, updateTeamDto);
      return {
        success: true,
        team,
      };
    } catch (error) {
      this.logger.error(
        `Error updating team ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to update team',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete team',
    description: 'Deletes a team. Cannot delete teams that have associated expenses.',
  })
  @ApiParam({
    name: 'id',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Team deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Team deleted successfully'
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiBadRequestResponse({
    description: 'Cannot delete team with associated expenses',
    schema: {
      example: {
        success: false,
        message: 'Cannot delete team with 5 associated expenses'
      }
    }
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  async remove(@Param('id') id: string) {
    try {
      await this.teamService.remove(id);
      return {
        success: true,
        message: 'Team deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error deleting team ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to delete team',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/budget-status')
  @ApiOperation({
    summary: 'Get team budget status',
    description: 'Retrieves detailed budget status for a team including utilization percentage, remaining budget, and alert status. Automatically sends budget alerts if thresholds are exceeded.',
  })
  @ApiParam({
    name: 'id',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiOkResponse({
    description: 'Budget status retrieved successfully',
    schema: {
      example: {
        success: true,
        budgetStatus: {
          teamId: '507f1f77bcf86cd799439011',
          teamName: 'Engineering Team',
          budget: 50000,
          currentSpending: 40000,
          remainingBudget: 10000,
          utilizationPercentage: 80.0,
          isOverBudget: false,
          isNearBudget: true,
          alertStatus: {
            eightyPercentSent: true,
            hundredPercentSent: false
          }
        }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  async getBudgetStatus(@Param('id') id: string) {
    try {
      const budgetStatus = await this.teamService.getBudgetStatus(id);
      return {
        success: true,
        budgetStatus,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching budget status for team ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to fetch budget status',
        },
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/expenses')
  @ApiOperation({
    summary: 'Get team expenses',
    description: 'Retrieves paginated list of expenses for a specific team with optional filtering.',
  })
  @ApiParam({
    name: 'id',
    description: 'Team ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by expense status',
    required: false,
    enum: ['pending', 'approved', 'rejected'],
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
  @ApiOkResponse({
    description: 'Team expenses retrieved successfully',
    type: PaginatedResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Team not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
  })
  async getExpenses(@Param('id') id: string, @Query() query: any) {
    try {
      const result = await this.teamService.getExpenses(id, query);
      return {
        success: true,
        expenses: result.expenses,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching expenses for team ${id}: ${error instanceof Error ? error.message : String(error)}`,
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
}
