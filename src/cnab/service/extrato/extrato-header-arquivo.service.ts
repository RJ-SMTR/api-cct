import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { ExtratoHeaderArquivoRepository } from 'src/cnab/repository/extrato/extrato-header-arquivo.repository';
import { logWarn } from 'src/utils/log-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoHeaderArquivoService {
  private logger: Logger = new Logger('ExtratoHeaderArquivoService', { timestamp: true });

  constructor(private extHeaderArquivoRepository: ExtratoHeaderArquivoRepository) { }

  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.extHeaderArquivoRepository.save(obj);
  }

  public async saveFrom104(header: CnabHeaderArquivo104): Promise<SaveIfNotExists<ExtratoHeaderArquivo>> {
    // Save Header Arquivo
    const extratoHeaderArquivo = new ExtratoHeaderArquivo({
      tipoArquivo: header.tipoArquivo.convertedValue,
      codigoBanco: header.codigoBanco.stringValue,
      tipoInscricao: header.tipoInscricao.stringValue,
      numeroInscricao: header.numeroInscricao.stringValue,
      codigoConvenio: header.codigoConvenioBanco.stringValue,
      parametroTransmissao: header.parametroTransmissao.stringValue,
      agencia: header.agenciaContaCorrente.stringValue,
      dvAgencia: header.dvAgencia.stringValue,
      numeroConta: header.numeroConta.stringValue,
      dvConta: header.dvConta.stringValue,
      nomeEmpresa: header.nomeEmpresa.convertedValue,
      dataGeracao: header.dataGeracaoArquivo.convertedValue,
      horaGeracao: header.horaGeracaoArquivo.convertedValue,
      nsa: header.nsa.convertedValue,
    });
    const saveHA = await this.extHeaderArquivoRepository.saveIfNotExists(extratoHeaderArquivo);
    if (!saveHA.isNewItem) {
      logWarn(this.logger, 'ExtratoHeaderArquivo já existe, ignorando...');
    }
    return saveHA;
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderArquivo>,): Promise<Nullable<ExtratoHeaderArquivo>> {
    return await this.extHeaderArquivoRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderArquivo>,
  ): Promise<ExtratoHeaderArquivo[]> {
    return await this.extHeaderArquivoRepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extHeaderArquivoRepository.getNextNumeroDocumento(date);
  }
}
