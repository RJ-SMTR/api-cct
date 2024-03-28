import { Injectable, Logger } from '@nestjs/common';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { FindOptionsWhere } from 'typeorm';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { HeaderArquivoRepository } from '../../repository/pagamento/header-arquivo.repository';
import { PagadorService } from './pagador.service';

const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class HeaderArquivoService {
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoRepository: HeaderArquivoRepository,
    private pagadorService: PagadorService,
  ) { }

  /**
   * Generate new HaderArquivo from Transacao
   */
  public async generateFromTransacao(
    transacao: Transacao,
    tipo_arquivo: HeaderArquivoTipoArquivo,
  ): Promise<HeaderArquivoDTO> {
    const now = new Date();
    const pagador = await this.pagadorService.getOneByIdPagador(transacao.pagador.id);
    const dto = new HeaderArquivoDTO({
      agencia: pagador.agencia,
      codigoBanco: PgtoRegistros.headerArquivo.codigoBanco.value,
      tipoInscricao: PgtoRegistros.headerArquivo.tipoInscricao.value,
      numeroInscricao: String(pagador.cpfCnpj),
      codigoConvenio: PgtoRegistros.headerArquivo.codigoConvenioBanco.value,
      parametroTransmissao: PgtoRegistros.headerArquivo.parametroTransmissao.value,
      dataGeracao: now,
      horaGeracao: now,
      dvAgencia: pagador.dvAgencia,
      dvConta: pagador.dvConta,
      transacao: transacao,
      nomeEmpresa: pagador.nomeEmpresa,
      numeroConta: pagador.conta,
      tipoArquivo: tipo_arquivo,
      nsa: await this.getNextNSA(),
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.created),
    });
    return dto;
  }

  public async saveRetFrom104(cnab104: CnabFile104Pgto, headerArquivoRemessa: HeaderArquivo
  ): Promise<SaveIfNotExists<HeaderArquivo>> {
    const headerArquivo = new HeaderArquivoDTO({
      tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
      codigoBanco: cnab104.headerArquivo.codigoBanco.stringValue,
      tipoInscricao: cnab104.headerArquivo.tipoInscricao.stringValue,
      numeroInscricao: cnab104.headerArquivo.numeroInscricao.stringValue,
      codigoConvenio: cnab104.headerArquivo.codigoConvenioBanco.stringValue,
      parametroTransmissao: cnab104.headerArquivo.parametroTransmissao.stringValue,
      agencia: cnab104.headerArquivo.agenciaContaCorrente.stringValue,
      dvAgencia: cnab104.headerArquivo.dvAgencia.stringValue,
      numeroConta: cnab104.headerArquivo.numeroConta.stringValue,
      dvConta: cnab104.headerArquivo.dvConta.stringValue,
      nomeEmpresa: cnab104.headerArquivo.nomeEmpresa.convertedValue,
      dataGeracao: cnab104.headerArquivo.dataGeracaoArquivo.convertedValue,
      horaGeracao: cnab104.headerArquivo.horaGeracaoArquivo.convertedValue,
      transacao: { id: headerArquivoRemessa.transacao.id } as Transacao,
      nsa: cnab104.headerArquivo.nsa.convertedValue,
    });
    return await this.headerArquivoRepository.saveIfNotExists(headerArquivo);
  }

  public async findAllNewRemessa(): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.findAllRemessaForPublicacao();
  }

  public async findMany(
    fields: FindOptionsWhere<HeaderArquivo> | FindOptionsWhere<HeaderArquivo>[]
  ): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.findMany(fields);
  }

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivo>> {
    return await this.headerArquivoRepository.saveIfNotExists(dto);
  }

  public async save(dto: HeaderArquivoDTO): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.save(dto);
  }

  public async getNextNSA() {
    return await this.headerArquivoRepository.getNextNSA();
  }


  public async getOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
  ): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.getOne(fields);
  }
}

