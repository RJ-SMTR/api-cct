import { IsNotEmpty, ValidateIf } from 'class-validator';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheAConf } from 'src/cnab/entity/conference/detalhe-a-conf.entity';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { HeaderLoteConf } from 'src/cnab/entity/conference/header-lote-conf.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Cnab104CodigoCompromisso } from 'src/cnab/enums/104/cnab-104-codigo-compromisso.enum';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { CnabRegistros104Pgto, CnabRegistros104PgtoDTO } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { DeepPartial } from 'typeorm';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { HeaderArquivoDTO } from './header-arquivo.dto';

interface IHeaderLoteDetalhes {
  detalheA: DetalheA | DetalheAConf;
  detalheB: DetalheB | DetalheBConf;
  favorecido: ClienteFavorecido;
}

function isCreate(object: HeaderLoteDTO): boolean {
  return object.id === undefined;
}

export class HeaderLoteDTO {
  constructor(dto?: DeepPartial<HeaderLoteDTO>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  static fromHeaderArquivoDTO(
    headerArquivo: HeaderArquivoDTO, //
    pagador: Pagador,
    formaLancamento: Cnab104FormaLancamento,
    isTeste?: boolean,
  ) {
    return new HeaderLoteDTO({
      codigoConvenioBanco: headerArquivo.codigoConvenio,
      pagador: pagador,
      numeroInscricao: headerArquivo.numeroInscricao,
      parametroTransmissao: headerArquivo.parametroTransmissao,
      tipoCompromisso: String(Cnab104PgtoTemplates.file104.registros.headerLote.tipoCompromisso.value),
      tipoInscricao: headerArquivo.tipoInscricao,
      headerArquivo: headerArquivo,
      loteServico: 1,
      formaLancamento,
      codigoCompromisso: isTeste ? Cnab104CodigoCompromisso.Teste : Cnab104CodigoCompromisso.Producao,
    });
  }

  static fromEntity(headerLote: HeaderLote | HeaderLoteConf, detalhes: IHeaderLoteDetalhes[]): HeaderLoteDTO {
    return new HeaderLoteDTO({
      codigoConvenioBanco: headerLote.codigoConvenioBanco,
      pagador: headerLote.pagador,
      numeroInscricao: headerLote.numeroInscricao,
      parametroTransmissao: headerLote.parametroTransmissao,
      tipoCompromisso: headerLote.tipoCompromisso,
      tipoInscricao: headerLote.tipoInscricao,
      headerArquivo: headerLote.headerArquivo,
      loteServico: headerLote.loteServico,
      formaLancamento: headerLote.formaLancamento == '41' ? Cnab104FormaLancamento.TED : Cnab104FormaLancamento.CreditoContaCorrente,
      registros104: detalhes.map((d) => CnabRegistros104PgtoDTO.fromEntity(d.detalheA, d.detalheB, d.favorecido)),
    });
  }

  static fromEntities(headerLotes: (HeaderLote | HeaderLoteConf)[], detalheAs: (DetalheA | DetalheAConf)[], detalheBs: (DetalheB | DetalheBConf)[], itemTransacoes: ItemTransacao[]): HeaderLoteDTO[] {
    const lotes: HeaderLoteDTO[] = [];
    for (const headerLote of headerLotes) {
      const loteDetalheAs = detalheAs.filter((da) => da.headerLote.id == headerLote.id);
      const entityArgs = loteDetalheAs.reduce((l: IHeaderLoteDetalhes[], detalheA) => {
        const detalheB = detalheBs.find((db) => db.detalheA.id == detalheA.id);
        const favorecido = itemTransacoes.find((it) => it.itemTransacaoAgrupado.id == detalheA.itemTransacaoAgrupado.id)?.clienteFavorecido;
        if (detalheB && favorecido) {
          return [...l, { detalheA, detalheB, favorecido }];
        } else {
          return l;
        }
      }, []);
      lotes.push(HeaderLoteDTO.fromEntity(headerLote, entityArgs));
    }
    return lotes;
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerArquivo?: DeepPartial<HeaderArquivo>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenioBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoCompromisso?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: DeepPartial<Pagador>;

  /** Código definido pelo banco, se será teste ou produção */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoCompromisso?: Cnab104CodigoCompromisso;

  ocorrenciasCnab?: string;

  /** 
   * Usado apenas para geração do remessa, não é salvo no banco 
   * 
   * O formaLancamento depende do codigoBancoFavorecido.
   * /
  codigoBancoFavorecido: string;

  /** Usado apenas para geração do remessa, não é salvo no banco */
  formaLancamento: Cnab104FormaLancamento;

  /** Usado apenas para geração do remessa, não é salvo no banco */
  // itemTransacaoAgrupados: ItemTransacaoAgrupado[] = [];

  /**
   * Usado apenas para geração do remessa, não é salvo no banco
   *
   * Após armazenar os itemTransacaoAgrupados, gera os respectivos detalhes
   * e armazena neste DTO para gerar o CNAB.
   */
  registros104: CnabRegistros104Pgto[] = [];
}
