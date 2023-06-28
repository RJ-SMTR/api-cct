import { Module } from '@nestjs/common';
import { AuthLicenseeController } from './auth-licensee.controller';
import { AuthLicenseeService } from './auth-licensee.service';
import { SgtuModule } from 'src/sgtu/sgtu.module';

@Module({
  imports: [SgtuModule],
  controllers: [AuthLicenseeController],
  providers: [AuthLicenseeService],
})
export class AuthLicenseeModule {}
