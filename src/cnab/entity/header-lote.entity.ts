import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { HeaderArquivo } from './header-arquivo.entity';
import { Pagador } from './pagador.entity';

@Entity()
export class HeaderLote extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => HeaderArquivo, { eager: true })
  headerArquivo: HeaderArquivo;

  @Column({ type: String, unique: false, nullable: true })
  loteServico: string | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  codigoConvenioBanco: string | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoCompromisso: string | null;

  @Column({ type: String, unique: false, nullable: true })
  parametroTransmissao: string | null;

  @ManyToOne(() => Pagador, { eager: true })
  pagador: Pagador;
}
