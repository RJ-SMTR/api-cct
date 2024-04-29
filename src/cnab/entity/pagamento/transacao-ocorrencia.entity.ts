import { EntityHelper } from 'src/utils/entity-helper';
import {
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transacao } from './transacao.entity';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { Enum } from 'src/utils/enum';

@Entity()
export class TransacaoOcorrencia extends EntityHelper {
  constructor(clienteFavorecido?: DeepPartial<TransacaoOcorrencia>) {
    super();
    if (clienteFavorecido !== undefined) {
      Object.assign(this, clienteFavorecido);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ocorrencia_id' })
  id: number;

  @ManyToOne(() => Transacao)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_transacao_ManyToOne',
  })
  transacao: Transacao;

  /** uniqueConstraintName: UQ_TransacaoOcorrencia_code */
  @Column({ type: String, unique: true, nullable: false, length: 2 })
  code: string;

  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;

  /**
   * @returns A list of new TransacaoOcorrencia. Without Transacao defined
   */
  public static newList(ocorrenciaCodes: string): TransacaoOcorrencia[] {
    const codes: string[] = [];
    for (let i = 0; i < ocorrenciaCodes.length; i += 2) {
      const code = ocorrenciaCodes.slice(i, i + 2);
      if (code.length > 0) {
        codes.push(code);
      }
    }

    const ocorrencias: TransacaoOcorrencia[] = [];
    for (const code of codes) {
      const message: string = Enum.getValue(OcorrenciaEnum, code, {
        defaultValue: `${code} - Código desconhecido.`,
      });
      ocorrencias.push(
        new TransacaoOcorrencia({
          code: code,
          message: message,
        }),
      );
    }

    return ocorrencias;
  }
}
