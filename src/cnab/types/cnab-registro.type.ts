import { ICnabRegistroBase } from '../interfaces/cnab-registro-base.interface';
import { CnabField } from './cnab-field.type';

export type CnabRegistro = Record<string, CnabField> & ICnabRegistroBase;
