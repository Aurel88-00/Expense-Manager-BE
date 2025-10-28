import { IsString, IsNumber, IsArray, ValidateNested, IsEmail, IsEnum, IsOptional, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRole } from '@shared/lib';

export class TeamMemberDto {
  @ApiProperty({
    description: 'Full name of the team member',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address of the team member',
    example: 'john.doe@company.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Role of the team member',
    enum: MemberRole,
    example: MemberRole.MEMBER,
  })
  @IsEnum(MemberRole)
  role: MemberRole;
}

export class CreateTeamDto {
  @ApiProperty({
    description: 'Name of the team',
    example: 'Engineering Team',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Budget allocated to the team in USD',
    example: 50000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  budget: number;

  @ApiProperty({
    description: 'List of team members',
    type: [TeamMemberDto],
    example: [
      {
        name: 'John Doe',
        email: 'john.doe@company.com',
        role: 'member'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        role: 'admin'
      }
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members: TeamMemberDto[];
}

export class UpdateTeamDto {
  @ApiPropertyOptional({
    description: 'Updated name of the team',
    example: 'Engineering Team - Updated',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated budget allocated to the team in USD',
    example: 75000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    description: 'Updated list of team members',
    type: [TeamMemberDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members?: TeamMemberDto[];
}

export class TeamResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the team',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Name of the team',
    example: 'Engineering Team',
  })
  name: string;

  @ApiProperty({
    description: 'Budget allocated to the team in USD',
    example: 50000,
  })
  budget: number;

  @ApiProperty({
    description: 'Current spending amount in USD',
    example: 25000,
  })
  currentSpending: number;

  @ApiProperty({
    description: 'List of team members',
    type: [TeamMemberDto],
  })
  members: TeamMemberDto[];

  @ApiProperty({
    description: 'Budget alert status',
    example: {
      eightyPercentSent: false,
      hundredPercentSent: false,
    },
  })
  budgetAlerts: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };

  @ApiProperty({
    description: 'Team creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Team last update timestamp',
    example: '2024-01-20T14:45:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Budget utilization percentage',
    example: 50.5,
  })
  budgetUtilization?: number;

  @ApiPropertyOptional({
    description: 'Remaining budget amount in USD',
    example: 25000,
  })
  remainingBudget?: number;
}
