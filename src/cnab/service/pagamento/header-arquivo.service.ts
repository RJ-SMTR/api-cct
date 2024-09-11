import { Injectable } from '@nestjs/common';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { SettingsService } from 'src/settings/settings.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { getBRTFromUTC } from 'src/utils/date-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { HeaderArquivoRepository } from '../../repository/pagamento/header-arquivo.repository';
import { PagadorService } from './pagador.service';
import { Cnab104AmbienteCliente } from 'src/cnab/enums/104/cnab-104-ambiente-cliente.enum';

const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class HeaderArquivoService {
  public async getHeaderArquivoNsa(index: number) {
    return this.getOne({ nsa: index });
  }

  private logger = new CustomLogger('HeaderArquivoService', { timestamp: true });

  constructor(
    private headerArquivoRepository: HeaderArquivoRepository, //
    private pagadorService: PagadorService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Generate new HaderArquivo from Transacao
   */
  public async getDTO(tipo_arquivo: HeaderArquivoTipoArquivo, transacaoAg: TransacaoAgrupado, isTeste?: boolean): Promise<HeaderArquivoDTO> {
    const now = getBRTFromUTC(new Date());
    const pagador = await this.pagadorService.getOneByIdPagador(transacaoAg?.pagador.id);
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
      transacaoAgrupado: transacaoAg,
      nomeEmpresa: pagador.nomeEmpresa,
      numeroConta: pagador.conta,
      tipoArquivo: tipo_arquivo,
      nsa: await this.settingsService.getNextNSA(isTeste),
      ambienteCliente: isTeste ? Cnab104AmbienteCliente.Teste : Cnab104AmbienteCliente.Producao,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.remessa),
    });
    return dto;
  }

  public async saveRetornoFrom104(cnab104: CnabFile104Pgto, headerArquivoRemessa: HeaderArquivo) {
    const headerArquivoRem = await this.headerArquivoRepository.getOne({
      nsa: cnab104.headerArquivo.nsa.convertedValue,
    });
    const headerArquivo = new HeaderArquivoDTO({
      id: headerArquivoRem.id,
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
      transacaoAgrupado: headerArquivoRemessa.transacaoAgrupado,
      nsa: cnab104.headerArquivo.nsa.convertedValue,
      ambienteCliente: cnab104.headerArquivo.ambienteCliente.value,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.retorno),
    });
    return await this.headerArquivoRepository.save(headerArquivo);
  }

  public async findOne(fields: FindOptionsWhere<HeaderArquivo> | FindOptionsWhere<HeaderArquivo>[]): Promise<HeaderArquivo | null> {
    return (await this.headerArquivoRepository.findOne({ where: fields })) || null;
  }

  public async findMany(fields: FindOptionsWhere<HeaderArquivo> | FindOptionsWhere<HeaderArquivo>[]): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.findMany({ where: fields });
  }

  /**
   * key: HeaderArquivo unique id
   */
  public saveManyIfNotExists(dtos: HeaderArquivoDTO[]): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.saveManyIfNotExists(dtos);
  }

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivo>> {
    return await this.headerArquivoRepository.saveIfNotExists(dto);
  }

  public async save(dto: DeepPartial<HeaderArquivo>): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.save(dto);
  }

  public async getOne(fields: EntityCondition<HeaderArquivo>): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.getOne(fields);
  }
}
