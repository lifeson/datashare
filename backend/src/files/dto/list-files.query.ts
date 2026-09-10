import { IsIn, IsOptional } from 'class-validator';

export class ListFilesQueryDto {
  /** Onglet de filtrage. Défaut : tous. */
  @IsOptional()
  @IsIn(['all', 'active', 'expired'])
  status: 'all' | 'active' | 'expired' = 'all';
}
