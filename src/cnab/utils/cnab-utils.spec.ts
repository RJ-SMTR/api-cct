import {
  getCnabRegistros,
  processCnabFile,
  stringifyCnabFile,
  stringifyCnabRegistro,
  validateCnabRegistroPosition,
} from './cnab-utils';
import { CnabFields } from '../types/cnab-field.type';
import { CnabFile } from '../types/cnab-file.type';
import { CnabLote } from '../types/cnab-lote.type';
import { CnabRegistro } from '../types/cnab-registro.type';
import { ICnabFieldMap } from '../interfaces/cnab-field-map.interface';
import * as path from 'path';
import * as fs from 'fs';
import { cnab240GenericFieldMapTemplateTest } from '../test/templates/240/generic/cnab-240-generic-field-map-template-test.const';
import { cnab240GenericHeaderArquivoTemplateTest } from '../test/templates/240/generic/cnab-240-generic-header-arquivo-template-test.const';
import { cnab240GenericTrailerArquivoTemplateTest } from '../test/templates/240/generic/cnab-240-generic-trailer-arquivo-template-test.const';
import { cnab240GenericHeaderLoteTemplateTest } from '../test/templates/240/generic/cnab-240-generic-header-lote-template-test.const';
import { cnab240GenericTrailerLoteTemplateTest } from '../test/templates/240/generic/cnab-240-generic-trailer-lote-template-test.const';
import { cnab240GenericDetalheATemplateTest } from '../test/templates/240/generic/cnab-240-generic-detalhe-a-template-test.const';
import { cnab240GenericDetalheBTemplateTest } from '../test/templates/240/generic/cnab-240-generic-detalhe-b-template-test.const';
import { cnab240GenericDetalheCTemplateTest } from '../test/templates/240/generic/cnab-240-generic-detalhe-c-template-test.const';

process.env.TZ = 'UTC';

describe('cnab-utils.ts', () => {
  const templatesPath = path.join(__dirname, '..', 'test', 'templates');
  const sc = structuredClone;
  describe('stringifyCnabFile()', () => {
    it('should return text version of CnabFile accordingly', () => {
      // Arrange
      const map = cnab240GenericFieldMapTemplateTest.base;
      const mapDetalheB = cnab240GenericFieldMapTemplateTest.detalheB;
      const headerArquivo: CnabRegistro = {
        fields: sc(cnab240GenericHeaderArquivoTemplateTest),
        fieldMap: map,
      };
      const trailerArquivo: CnabRegistro = {
        fields: sc(cnab240GenericTrailerArquivoTemplateTest),
        fieldMap: map,
      };
      const headerLote: CnabRegistro = {
        fields: sc(cnab240GenericHeaderLoteTemplateTest),
        fieldMap: map,
      };
      const trailerLote: CnabRegistro = {
        fields: sc(cnab240GenericTrailerLoteTemplateTest),
        fieldMap: map,
      };
      const detalheA: CnabRegistro = {
        fields: sc(cnab240GenericDetalheATemplateTest),
        fieldMap: map,
      };
      const detalheB: CnabRegistro = {
        fields: sc(cnab240GenericDetalheBTemplateTest),
        fieldMap: mapDetalheB,
      };
      const detalheC: CnabRegistro = {
        fields: sc(cnab240GenericDetalheCTemplateTest),
        fieldMap: map,
      };

      const lote: CnabLote = {
        headerLote: headerLote,
        registros: [sc(detalheA), sc(detalheB)],
        trailerLote: trailerLote,
      };

      const loteN: CnabLote = { ...sc(lote) };
      loteN.registros.push(detalheC);

      const cnab: CnabFile = {
        headerArquivo: headerArquivo,
        lotes: [sc(lote), sc(lote), sc(loteN)],
        trailerArquivo: trailerArquivo,
      };
      const expectedResponseFilePath = path.join(
        templatesPath,
        '240',
        'generic',
        'example-240-generic.rem',
      );
      const expectedResponse = fs
        .readFileSync(expectedResponseFilePath, 'utf-8')
        .replace(/\r\n/g, '\n');

      // Act
      const response = stringifyCnabFile(cnab).replace(/\r\n/g, '\n');

      // Assert
      expect(response.length).toEqual(expectedResponse.length);
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('stringifyCnabRegistro()', () => {
    it('should return text version of Registro accordingly', () => {
      // Arrange
      const registro: CnabRegistro = {
        fields: {
          codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
          loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
          codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
          nsr: { pos: [9, 240], picture: 'X(232)', value: 'A' },
        },
      };

      // Act
      const result = stringifyCnabRegistro(registro);

      // Assert
      expect(result).toEqual('10400013A' + ' '.repeat(231));
    });

    it('should throw exception when position doesnt match picture', () => {
      // Arrange
      const registro: CnabRegistro = {
        fields: {
          codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
          loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
          codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
          nsr: { pos: [9, 14], picture: '9(005)', value: 1 },
        },
      };

      // Act
      const result = () => stringifyCnabRegistro(registro);

      // Assert
      expect(result).toThrowError();
    });
  });

  describe('validateCnabRegistroPosition()', () => {
    it('should return when previous and current CnabFields have valid positions', () => {
      // Act
      const result = () =>
        validateCnabRegistroPosition(
          {
            picture: 'X(5)',
            pos: [16, 20],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should return when first CnabField has valid positions', () => {
      // Act
      const result = () =>
        validateCnabRegistroPosition(
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          undefined,
          true,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should return when last CnabField has valid positions', () => {
      // Act
      const result = () =>
        validateCnabRegistroPosition(
          {
            picture: '9(1)',
            pos: [16, 240],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          false,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should throw exception when first CnabField has invalid positions', () => {
      // Act
      const result = () =>
        validateCnabRegistroPosition(
          {
            picture: '9(15)',
            pos: [0, 14],
            value: '',
          },
          undefined,
          true,
        );

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when last CnabField has invalid positions', () => {
      // Act
      const result = () =>
        validateCnabRegistroPosition(
          {
            picture: '9(1)',
            pos: [16, 239],
            value: '',
          },
          undefined,
          false,
        );

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when previous and current CnabFields have invalid positions', () => {
      // Act
      const resultEqual = () =>
        validateCnabRegistroPosition(
          {
            picture: 'X(5)',
            pos: [15, 29],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );
      const resultLower = () =>
        validateCnabRegistroPosition(
          {
            picture: 'X(5)',
            pos: [14, 28],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );
      const resultGreather = () =>
        validateCnabRegistroPosition(
          {
            picture: 'X(5)',
            pos: [17, 31],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );

      // Assert
      expect(resultEqual).toThrowError();
      expect(resultLower).toThrowError();
      expect(resultGreather).toThrowError();
    });
  });

  describe('getCnabRegistros()', () => {
    const fields: CnabFields[] = [
      { a: { picture: 'X(1)', pos: [1, 1], value: ' ' } },
      { b: { picture: 'X(2)', pos: [1, 2], value: ' ' } },
      { c: { picture: 'X(3)', pos: [1, 3], value: ' ' } },
      { d: { picture: 'X(4)', pos: [1, 4], value: ' ' } },
      { e: { picture: 'X(5)', pos: [1, 5], value: ' ' } },
      { f: { picture: 'X(6)', pos: [1, 6], value: ' ' } },
      { g: { picture: 'X(7)', pos: [1, 7], value: ' ' } },
      { h: { picture: 'X(8)', pos: [1, 8], value: ' ' } },
      { i: { picture: 'X(9)', pos: [1, 9], value: ' ' } },
      { j: { picture: 'X(10)', pos: [1, 10], value: ' ' } },
      { k: { picture: 'X(11)', pos: [1, 11], value: ' ' } },
      { l: { picture: 'X(12)', pos: [1, 12], value: ' ' } },
      { m: { picture: 'X(13)', pos: [1, 13], value: ' ' } },
      { n: { picture: 'X(14)', pos: [1, 14], value: ' ' } },
      { o: { picture: 'X(15)', pos: [1, 15], value: ' ' } },
      { p: { picture: 'X(16)', pos: [1, 16], value: ' ' } },
      { q: { picture: 'X(17)', pos: [1, 17], value: ' ' } },
      { r: { picture: 'X(18)', pos: [1, 18], value: ' ' } },
      { s: { picture: 'X(19)', pos: [1, 19], value: ' ' } },
      { t: { picture: 'X(20)', pos: [1, 20], value: ' ' } },
      { u: { picture: 'X(21)', pos: [1, 21], value: ' ' } },
      { v: { picture: 'X(22)', pos: [1, 22], value: ' ' } },
      { w: { picture: 'X(23)', pos: [1, 23], value: ' ' } },
      { x: { picture: 'X(24)', pos: [1, 24], value: ' ' } },
    ];

    it('should convert CnabLote record', () => {
      // Arrange
      const registros: CnabRegistro[] = [
        { fields: { ...fields[0], ...fields[1] } },
        { fields: { ...fields[2], ...fields[3] } },
        { fields: { ...fields[4], ...fields[5] } },
        { fields: { ...fields[6], ...fields[7] } },
      ];
      const lote: CnabLote = {
        headerLote: registros[0],
        registros: [registros[1], registros[2]],
        trailerLote: registros[3],
      };

      // Act
      const result = getCnabRegistros(lote);

      // Assert
      expect(result).toEqual(registros);
    });

    it('should convert CnabFile record', () => {
      // Arrange
      const registros: CnabRegistro[] = [
        { fields: { ...fields[0], ...fields[1] } },
        { fields: { ...fields[2], ...fields[3] } },
        { fields: { ...fields[4], ...fields[5] } },
        { fields: { ...fields[6], ...fields[7] } },
        { fields: { ...fields[8], ...fields[9] } },
        { fields: { ...fields[10], ...fields[11] } },
        { fields: { ...fields[12], ...fields[13] } },
        { fields: { ...fields[14], ...fields[15] } },
        { fields: { ...fields[16], ...fields[27] } },
        { fields: { ...fields[18], ...fields[19] } },
      ];
      const lotes: CnabLote[] = [
        {
          headerLote: registros[1],
          registros: [registros[2], registros[3]],
          trailerLote: registros[4],
        },
        {
          headerLote: registros[5],
          registros: [registros[6], registros[7]],
          trailerLote: registros[8],
        },
      ];
      const file: CnabFile = {
        headerArquivo: registros[0],
        lotes,
        trailerArquivo: registros[9],
      };

      // Act
      const result = getCnabRegistros(file);

      // Assert
      expect(result).toEqual(registros);
    });
  });

  describe('processCnabFile()', () => {
    it('should insert count data correctly', () => {
      // Arrange
      const map: ICnabFieldMap = {
        registroIdField: 'codigoRegistro',
        registroLoteSequenceField: 'loteServico',
        trailerLoteRegistroCountField: 'quantidadeRegistrosLote',
        detalheSegmentoField: 'codigoSegmento',
        detalheLoteRegistroSequenceField: 'nsr',
        trailerArquivoLoteCountField: 'quantidadeLotesArquivo',
        trailerArquivoRegistroCountField: 'quantidadeRegistrosArquivo',
      };
      const fieldsBase: CnabFields = {
        codigoRegistro: { pos: [1, 1], picture: '9(001)', value: '' },
        loteServico: { pos: [2, 5], picture: '9(004)', value: '' },
        quantidadeRegistrosLote: { pos: [6, 11], picture: '9(006)', value: '' },
        codigoSegmento: { pos: [12, 12], picture: 'X(001)', value: 'N' },
        nsr: { pos: [13, 17], picture: '9(005)', value: '' },
        quantidadeLotesArquivo: { pos: [18, 23], picture: '9(006)', value: '' },
        quantidadeRegistrosArquivo: {
          pos: [24, 29],
          picture: '9(006)',
          value: '',
        },
        filler: { pos: [30, 240], picture: 'X(211)', value: ' ' },
      };
      const lote: CnabLote = {
        headerLote: { fields: sc(fieldsBase), fieldMap: map },
        registros: [
          { fields: sc(fieldsBase), fieldMap: map },
          { fields: sc(fieldsBase), fieldMap: map },
        ],
        trailerLote: { fields: sc(fieldsBase), fieldMap: map },
      };
      const cnab: CnabFile = {
        headerArquivo: { fields: sc(fieldsBase), fieldMap: map },
        lotes: [sc(lote), sc(lote), sc(lote)],
        trailerArquivo: { fields: sc(fieldsBase), fieldMap: map },
      };

      // Act
      const response = sc(cnab);
      processCnabFile(response);

      // Assert
      expect(response.lotes[0].registros[0].fields.nsr.value).toEqual(1);
      expect(response.lotes[0].registros[1].fields.nsr.value).toEqual(2);
      expect(response.lotes[0].registros[0].fields.loteServico.value).toEqual(
        1,
      );
      expect(response.lotes[1].registros[0].fields.loteServico.value).toEqual(
        2,
      );
      expect(response.lotes[1].registros[1].fields.loteServico.value).toEqual(
        2,
      );
      expect(response.lotes[2].registros[0].fields.loteServico.value).toEqual(
        3,
      );
      expect(
        response.lotes[0].trailerLote.fields.quantidadeRegistrosLote.value,
      ).toEqual(4);
      expect(
        response.trailerArquivo.fields.quantidadeLotesArquivo.value,
      ).toEqual(3);
      expect(
        response.trailerArquivo.fields.quantidadeRegistrosArquivo.value,
      ).toEqual(14);
    });
  });
});
