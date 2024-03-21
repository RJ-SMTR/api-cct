import { EntityHelper } from "src/utils/entity-helper";
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { HeaderArquivo } from "./pagamento/header-arquivo.entity";

@Entity()
export class ArquivoPublicacao extends EntityHelper {
  constructor(
    arquivoPublicacao: ArquivoPublicacao | DeepPartial<ArquivoPublicacao>,
  ) {
    super();
    if (arquivoPublicacao !== undefined) {
      Object.assign(this, arquivoPublicacao);
    }
  }
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ArquivoPublicacao_id' })
  id: number;

  @ManyToOne(() => HeaderArquivo)
  @JoinColumn({ foreignKeyConstraintName: 'FK_ArquivoPublicacao_headerArquivo_ManyToOne' })
  headerArquivo: HeaderArquivo;

  @Column({ type: String, unique: false, nullable: false })
  idTransacao: number;

  @Column({ type: String, unique: false, nullable: false })
  idHeaderLote: number;

  @Column({ type: Date, unique: false, nullable: false })
  dataGeracaoRemessa: Date;

  @Column({ type: Date, unique: false, nullable: false })
  horaGeracaoRemessa: Date;

  @Column({ type: Date, unique: false, nullable: false })
  dataGeracaoRetorno: Date;

  @Column({ type: Date, unique: false, nullable: false })
  horaGeracaoRetorno: Date;

  @Column({ type: Number, unique: false, nullable: false })
  loteServico: number;

  @Column({ type: String, unique: false, nullable: false })
  nomePagador: string;

  @Column({ type: String, unique: false, nullable: false })
  agenciaPagador: string;

  @Column({ type: String, unique: false, nullable: false })
  dvAgenciaPagador: string;

  @Column({ type: String, unique: false, nullable: false })
  contaPagador: string;

  @Column({ type: String, unique: false, nullable: false })
  dvContaPagador: string;

  @Column({ type: String, unique: false, nullable: false })
  nomeCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  cpfCnpjCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  codigoBancoCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  agenciaCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  dvAgenciaCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  contaCorrenteCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  dvContaCorrenteCliente: string;

  @Column({ type: String, unique: false, nullable: false })
  dataVencimento: Date;

  @Column({ type: String, unique: false, nullable: false })
  valorLancamento: number;

  @Column({ type: String, unique: false, nullable: false })
  dataEfetivacao: Date;

  @Column({ type: String, unique: false, nullable: false })
  valorRealEfetivado: number;

  @Column({ type: String, unique: false, nullable: true })
  ocorrencias: string;

  @Column({ type: Number, unique: false, nullable: false })
  idDetalheARetorno: number;
}