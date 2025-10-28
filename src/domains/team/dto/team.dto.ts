import { IsString, IsNumber, IsArray, ValidateNested, IsEmail, IsEnum, IsOptional, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { MemberRole } from '@shared/lib';

export class TeamMemberDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(MemberRole)
  role: MemberRole;
}

export class CreateTeamDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  budget: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members: TeamMemberDto[];
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members?: TeamMemberDto[];
}

export class TeamResponseDto {
  _id: string;
  name: string;
  budget: number;
  currentSpending: number;
  members: TeamMemberDto[];
  budgetAlerts: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  budgetUtilization?: number;
  remainingBudget?: number;
}
