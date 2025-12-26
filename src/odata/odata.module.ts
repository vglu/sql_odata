import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ODataController } from './odata.controller';
import { ODataService } from './odata.service';
import { ODataParserService } from './odata-parser.service';

@Module({
  imports: [ConfigModule],
  controllers: [ODataController],
  providers: [ODataService, ODataParserService],
  exports: [ODataService], // Экспортируем для использования в других модулях
})
export class ODataModule {}

