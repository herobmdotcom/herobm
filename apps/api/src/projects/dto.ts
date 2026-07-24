import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class CreateProjectNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ProjectNoteResponseDto {
  @IsUUID()
  noteId!: string;

  @IsString()
  content!: string;

  @IsString()
  createdOn!: Date;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  createdBy?: unknown;
}

export class CreateProjectContactDto {
  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class CreateProjectActorDto {
  @IsUUID()
  actorId!: string;

  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class UpdateProjectActorDto {
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class ProjectResponseDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  name!: string;

  @IsString()
  status!: string;

  @IsString()
  type!: string;

  @IsString()
  createdOn!: Date;

  @IsString()
  modifiedOn!: Date;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  owner?: unknown;

  @IsOptional()
  notes?: ProjectNoteResponseDto[];

  @IsOptional()
  projectActors?: unknown[];

  @IsOptional()
  projectContacts?: unknown[];
}

export class UpdateProjectContactDto {
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}
