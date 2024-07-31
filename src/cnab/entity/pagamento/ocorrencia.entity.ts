import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheA } from './detalhe-a.entity';
import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';

const userErrors = ['AG', 'AL', 'AM', 'AN', 'AO', 'AS', 'BG', 'DA', 'DB', 'ZA', 'ZY', '02'];

const successOcorrencias = ['BD', '00'];

@Entity()
export class Ocorrencia extends EntityHelper {
  constructor(ocorrencias?: DeepPartial<Ocorrencia>) {
    super();
    if (ocorrencias !== undefined) {
      Object.assign(this, ocorrencias);
    }
  }

  public static fromEnum(value: OcorrenciaEnum) {
    return new Ocorrencia({
      code: Enum.getKey(OcorrenciaEnum, value),
      message: value,
    });
  }

  @Exclude()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ocorrencia_id' })
  id: number;

  @Exclude()
  @ManyToOne(() => DetalheA, { nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_detalheA_ManyToOne',
  })
  detalheA: DetalheA | null;

  @SetValue((v, o) => Ocorrencia.toUserValues(o).code)
  @Column({ type: String, unique: false, nullable: false, length: 2 })
  code: string;

  @SetValue((v, o) => Ocorrencia.toUserValues(o).message)
  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;

  public static getCodesList(ocorrenciaCodes: string) {
    const codes = ocorrenciaCodes.replace(/ /gm, '');
    const codesList: string[] = [];
    for (let i = 0; i < codes.length; i += 2) {
      const code = codes.slice(i, i + 2);
      if (code.length > 0) {
        codesList.push(code);
      }
    }
    return codesList;
  }

  /**
   * @returns A list of new TransacaoOcorrencia. Without Transacao defined
   */
  public static fromCodesString(ocorrenciaCodes: string): Ocorrencia[] {
    const codesList = Ocorrencia.getCodesList(ocorrenciaCodes);
    const ocorrencias: Ocorrencia[] = [];
    for (const code of codesList) {
      const message: string = Enum.getValue(OcorrenciaEnum, code, {
        defaultValue: `${code} - Código desconhecido.`,
      });
      ocorrencias.push(
        new Ocorrencia({
          code: code,
          message: message,
        }),
      );
    }
    return ocorrencias;
  }

  public static getErrorCodes(ocorrencias: Ocorrencia[]) {
    const codesList = ocorrencias.map((o) => o.code);
    const errors = codesList.filter((c) => !['00', 'BD'].includes(c));
    return errors;
  }

  public static getErrorCodesFromString(ocorrenciaCodes: string) {
    const codesList = Ocorrencia.getCodesList(ocorrenciaCodes);
    const errors = codesList.filter((c) => !['00', 'BD'].includes(c));
    return errors;
  }

  public static joinUniqueCode(old: Ocorrencia[], inserted: Ocorrencia[]) {
    const joined: Ocorrencia[] = [];
    for (const ocorrencia of [...old, ...inserted]) {
      if (joined.filter((i) => i.code === ocorrencia.code).length === 0) {
        joined.push(ocorrencia);
      }
    }
    return joined;
  }

  public static toUserValues(o: Ocorrencia) {
    return Ocorrencia.isUserError(o) ? new Ocorrencia({ ...o, code: '  ', message: OcorrenciaEnum['  '] }) : o;
  }

  public static isUserError(o: Ocorrencia) {
    return userErrors.includes(o.code);
  }

  /**
   * Oculta erros técnicos do usuário, exibindo uma mensagem genérica no lugar
   */
  public static toUserErrors(ocorrencias: Ocorrencia[]) {
    let newOcorrencias = ocorrencias.map((j) => (!userErrors.includes(j.code) ? new Ocorrencia({ ...j, code: '  ', message: OcorrenciaEnum['  '] }) : j));
    newOcorrencias = newOcorrencias.reduce((l: Ocorrencia[], j) => (l.map((k) => k.code).includes(j.code) ? l : [...l, j]), []);
    return newOcorrencias;
  }

  public static isError(ocorrencia?: Partial<Ocorrencia> | null) {
    const code = ocorrencia?.code;
    return code && !['BD', '00'].includes(code);
  }
}
