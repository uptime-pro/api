import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class SetMonitorTagsDto {
  @ApiProperty({ type: [Number], description: 'Monitor IDs to associate with this tag' })
  @IsArray()
  @IsInt({ each: true })
  monitorIds: number[];
}
