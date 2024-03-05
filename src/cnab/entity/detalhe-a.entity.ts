import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('detalhe_a')
export class DetalheA extends EntityHelper {
  @PrimaryGeneratedColumn()
  id_detalhe_a: number;
  @Column({ type: Number, unique: false, nullable: true })
  id_header_lote: number;
  @Column({ type: String, unique: false, nullable: true })
  lote_servico: string;
  @Column({ type: Number, unique: false, nullable: true })
  id_cliente_favorecido: number;
  @Column({ type: String, unique: false, nullable: true })
  tipo_finalidade_conta: string;
  @Column({ type: Date, unique: false, nullable: true })
  dt_vencimento: Date;
  @Column({ type: String, unique: false, nullable: true })
  tipo_moeda: string;
  @Column({ type: String, unique: false, nullable: true })
  valor_lancamento: number;
  @Column({ type: String, unique: false, nullable: true })
  num_doc_lancamento: string;
  @Column({ type: String, unique: false, nullable: true })
  qtde_parcelas: number;
  @Column({ type: String, unique: false, nullable: true })
  indicador_bloqueio: string;
  @Column({ type: String, unique: false, nullable: true })
  indicador_forma_parcelamento: string;
  @Column({ type: Date, unique: false, nullable: true })
  periodo_vencimento: Date;
  @Column({ type: String, unique: false, nullable: true })
  num_parcela: number;
  @Column({ type: Date, unique: false, nullable: true })
  data_efetivacao: Date;
  @Column({ type: Number, unique: false, nullable: true })
  valor_real_efetivado: number;
}
