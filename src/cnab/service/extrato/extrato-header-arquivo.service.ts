import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { ExtratoHeaderArquivoRepository } from 'src/cnab/repository/extrato/extrato-header-arquivo.repository';
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
      tipoArquivo: header.tipoArquivo.format.value,
      codigoBanco: header.codigoBanco.value,
      tipoInscricao: header.tipoInscricao.value,
      numeroInscricao: header.numeroInscricao.value,
      codigoConvenio: header.codigoConvenioBanco.value,
      parametroTransmissao: header.parametroTransmissao.value,
      agencia: header.agenciaContaCorrente.value,
      dvAgencia: header.dvAgencia.value,
      numeroConta: header.numeroConta.value,
      dvConta: header.dvConta.value,
      nomeEmpresa: header.nomeEmpresa.format.value,
      dataGeracao: header.dataGeracaoArquivo.format.value,
      horaGeracao: header.horaGeracaoArquivo.format.value,
      nsa: header.nsa.format?.value,
    });
    const saveHA = await this.extHeaderArquivoRepository.saveIfNotExists(extratoHeaderArquivo);
    if (!saveHA.isNewItem) {
      this.logger.warn('ExtratoHeaderArquivo já existe, ignorando...');
    }
    return saveHA;
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderArquivo> | EntityCondition<ExtratoHeaderArquivo>[],): Promise<Nullable<ExtratoHeaderArquivo>> {
    return await this.extHeaderArquivoRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderArquivo> | EntityCondition<ExtratoHeaderArquivo>[],
  ): Promise<ExtratoHeaderArquivo[]> {
    return await this.extHeaderArquivoRepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extHeaderArquivoRepository.getNextNumeroDocumento(date);
  }
}
