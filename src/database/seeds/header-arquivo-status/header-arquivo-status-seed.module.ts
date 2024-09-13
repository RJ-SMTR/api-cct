import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderArquivoStatusEnum } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivoStatusSeedService } from './header-arquivo-status-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeaderArquivoStatusEnum])],
  providers: [HeaderArquivoStatusSeedService],
  exports: [HeaderArquivoStatusSeedService],
})
export class HeaderArquivoStatusSeedModule {}
