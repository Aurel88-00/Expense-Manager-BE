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
import { TeamService } from '../services/team.service';
import { CreateTeamDto, UpdateTeamDto } from '../dto/team.dto';

@Controller('teams')
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  @Post()
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
