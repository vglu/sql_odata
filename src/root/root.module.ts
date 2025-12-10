import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ODataModule } from '../odata/odata.module';

@Module({
  imports: [ODataModule],
  controllers: [RootController],
})
export class RootModule {}



