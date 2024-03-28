import * as fs from 'fs';
import * as path from 'path';
import { Cnab104FormaLancamento } from '../enums/104/cnab-104-forma-lancamento.enum';
import { CnabFile104 } from '../interfaces/cnab-240/104/cnab-file-104.interface';
import { CnabLote104 } from '../interfaces/cnab-240/104/cnab-lote-104.interface';
import { CnabDetalheA_104 } from '../interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from '../interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabFile } from '../interfaces/cnab-file.interface';
import { CnabLote } from '../interfaces/cnab-lote.interface';
import { CnabRegistro } from '../interfaces/cnab-registro.interface';
import { cnab240_104DetalheATemplateTest } from '../test/templates/240/104/cnab-240-104-detalhe-a-template-test.const';
import { cnab240_104DetalheBTemplateTest } from '../test/templates/240/104/cnab-240-104-detalhe-b-template-test.const';
import { cnab240_104HeaderArquivoTemplateTest } from '../test/templates/240/104/cnab-240-104-header-arquivo-template-test.const';
import { cnab240_104HeaderLoteTemplateTest } from '../test/templates/240/104/cnab-240-104-header-lote-template-test.const';
import { cnab240_104TrailerArquivoTemplateTest } from '../test/templates/240/104/cnab-240-104-trailer-arquivo-template-test.const';
import { cnab240_104TrailerLoteTemplateTest } from '../test/templates/240/104/cnab-240-104-trailer-lote-template-test.const';
import { cnab240GenericDetalheATemplateTest } from '../test/templates/240/generic/cnab-240-generic-detalhe-a-template-test.const';
import { cnab240GenericDetalheBTemplateTest } from '../test/templates/240/generic/cnab-240-generic-detalhe-b-template-test.const';
import { cnab240GenericFieldMapTemplateTest } from '../test/templates/240/generic/cnab-240-generic-field-map-template-test.const';
import { cnab240GenericHeaderArquivoTemplateTest } from '../test/templates/240/generic/cnab-240-generic-header-arquivo-template-test.const';
import { cnab240GenericHeaderLoteTemplateTest } from '../test/templates/240/generic/cnab-240-generic-header-lote-template-test.const';
import { cnab240GenericTrailerArquivoTemplateTest } from '../test/templates/240/generic/cnab-240-generic-trailer-arquivo-template-test.const';
import { cnab240GenericTrailerLoteTemplateTest } from '../test/templates/240/generic/cnab-240-generic-trailer-lote-template-test.const';
import { getCnabFileFrom104 } from './cnab-104-pipe-utils';
import {
  getCnab104FromFile,
  stringifyCnab104File,
} from './cnab-104-utils';

describe('cnab-104-utils.ts', () => {
  const sc = structuredClone;
  const templatesPath = path.join(__dirname, '..', 'test', 'templates');
  const headerArquivo = cnab240_104HeaderArquivoTemplateTest;
  const trailerArquivo = cnab240_104TrailerArquivoTemplateTest;
  const headerLote = cnab240_104HeaderLoteTemplateTest;
  const trailerLote = cnab240_104TrailerLoteTemplateTest;
  const detalheA = cnab240_104DetalheATemplateTest;
  const detalheB = cnab240_104DetalheBTemplateTest;

  describe('getCnab104FromFile', () => {
    it('should convert to file accordingly', () => {
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

      const loteTest: CnabLote = {
        headerLote: headerLote,
        registros: [
          sc(detalheA),
          sc(detalheB),
          sc(detalheA),
          sc(detalheA),
          sc(detalheB),
        ],
        trailerLote: trailerLote,
      };

      const cnab: CnabFile = {
        headerArquivo: headerArquivo,
        lotes: [sc(loteTest)],
        trailerArquivo: trailerArquivo,
      };

      // Act
      const resultFunction = () => getCnab104FromFile(cnab);

      // Assert
      expect(resultFunction).not.toThrowError();
      const result = resultFunction();
      expect(result.headerArquivo).toEqual(headerArquivo.fields);
      expect(result.lotes[0].registros[0].detalheA).toEqual(
        cnab.lotes[0].registros[0].fields,
      );
      expect(result.lotes[0].registros[0].detalheB).toEqual(
        cnab.lotes[0].registros[1].fields,
      );
      expect(result.lotes[0].registros[1].detalheA).toEqual(
        cnab.lotes[0].registros[2].fields,
      );
      expect(result.lotes[0].registros[1].detalheB).toBeUndefined();
      expect(result.lotes[0].registros[2].detalheA).toEqual(
        cnab.lotes[0].registros[3].fields,
      );
      expect(result.lotes[0].registros[2].detalheB).toEqual(
        cnab.lotes[0].registros[4].fields,
      );
      expect(result.trailerArquivo).toEqual(trailerArquivo.fields);
    });
  });

  describe('stringifyCnab104File', () => {
    it('should return string version correctly', /**
     * Requirement: 2024/02/27 {@link https://github.com/RJ-SMTR/api-cct/issues/187#issuecomment-1965124944 #187, item 7 - GitHub}
     */ () => {
        // Arrange
        const lote: CnabLote104 = {
          headerLote: sc(headerLote),
          registros: [
            {
              detalheA: sc(detalheA),
              detalheB: sc(detalheB),
            },
            {
              detalheA: sc(detalheA),
              detalheB: sc(detalheB),
            },
          ],
          trailerLote: sc(trailerLote),
        };
        const lote0 = sc(lote);
        lote0.headerLote.formaLancamento.value = Cnab104FormaLancamento.DOC;
        const lote1 = sc(lote);
        lote0.headerLote.formaLancamento.value = Cnab104FormaLancamento.TED;

        const file: CnabFile104 = {
          headerArquivo: sc(headerArquivo),
          lotes: [sc(lote0), sc(lote1)],
          trailerArquivo: sc(trailerArquivo),
        };
        file.lotes[1].registros.push({
          detalheA: sc(detalheA),
          detalheB: sc(detalheB),
        });

        const expectedResponseFilePath = path.join(
          templatesPath,
          '240',
          '104',
          'example-240-104.rem',
        );
        const expectedResponse = fs
          .readFileSync(expectedResponseFilePath, 'utf-8')
          .replace(/\r\n/g, '\n');

        // Act
        const response = stringifyCnab104File(file).replace(/\r\n/g, '\n');

        // Assert
        expect(response).toEqual(expectedResponse);
      });
  });

  describe('getCnabFileFrom104', () => {
    it('should set CnabFields in the right places', () => {
      // Arrange
      const lote: CnabLote104 = {
        headerLote: sc(headerLote),
        registros: [
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
        ],
        trailerLote: sc(trailerLote),
      };
      const lote0 = sc(lote);
      const lote1 = sc(lote);

      lote0.headerLote.usoExclusivoFebraban.value = 'L0H';
      (
        lote0.registros[0].detalheA as CnabDetalheA_104
      ).usoExclusivoFebraban.value = 'L0R0A';
      (
        lote0.registros[1].detalheB as CnabDetalheB_104
      ).usoExclusivoFebraban.value = 'L0R1B';

      lote1.trailerLote.usoExclusivoFebraban.value = 'L1T';
      (
        lote1.registros[0].detalheB as CnabDetalheB_104
      ).usoExclusivoFebraban.value = 'L1R0B';
      (
        lote1.registros[1].detalheA as CnabDetalheA_104
      ).usoExclusivoFebraban.value = 'L1R1A';

      const file: CnabFile104 = {
        headerArquivo: sc(headerArquivo),
        lotes: [sc(lote0), sc(lote1)],
        trailerArquivo: sc(trailerArquivo),
      };

      // Act
      const response = getCnabFileFrom104(file);

      // Assert
      expect(response.headerArquivo.fields).toEqual(headerArquivo);
      expect(
        response.lotes[0].headerLote.fields.usoExclusivoFebraban.value,
      ).toEqual('L0H');
      expect(
        response.lotes[0].registros[0].fields.usoExclusivoFebraban.value,
      ).toEqual('L0R0A');
      expect(
        response.lotes[0].registros[3].fields.usoExclusivoFebraban.value,
      ).toEqual('L0R1B');
      expect(
        response.lotes[1].registros[1].fields.usoExclusivoFebraban.value,
      ).toEqual('L1R0B');
      expect(
        response.lotes[1].registros[2].fields.usoExclusivoFebraban.value,
      ).toEqual('L1R1A');
      expect(
        response.lotes[1].trailerLote.fields.usoExclusivoFebraban.value,
      ).toEqual('L1T');
      expect(response.trailerArquivo.fields).toEqual(trailerArquivo);
    });
  });
});
