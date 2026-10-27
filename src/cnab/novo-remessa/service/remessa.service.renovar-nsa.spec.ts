import { HttpException } from '@nestjs/common';
import { RemessaService } from './remessa.service';
import { HeaderArquivoStatus, HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';

describe('RemessaService.renovarNsaRemessa', () => {
  let service: RemessaService;
  let headerArquivoService: { findMany: jest.Mock; getExists: jest.Mock; save: jest.Mock };
  let settingsService: { getNextNSA: jest.Mock };

  beforeEach(() => {
    (global as any).__localTzOffset = 0;
    headerArquivoService = { findMany: jest.fn(), getExists: jest.fn().mockResolvedValue([]), save: jest.fn() };
    settingsService = { getNextNSA: jest.fn().mockResolvedValue(1270) };
    service = new RemessaService({} as any, headerArquivoService as any, {} as any, {} as any, {} as any, settingsService as any, {} as any, {} as any, {} as any, {} as any);
  });

  it('reabre o header enviado e rejeitado com o proximo NSA', async () => {
    headerArquivoService.findMany.mockResolvedValue([{ id: 50, nsa: 1269, status: HeaderArquivoStatus._3_remessaEnviado }]);

    const r = await service.renovarNsaRemessa(1269, HeaderName.MODAL);

    expect(headerArquivoService.save).toHaveBeenCalledWith({ id: 50, nsa: 1270, status: HeaderArquivoStatus._2_remessaGerado, remessaName: HeaderName.MODAL });
    expect(r).toEqual({ headerArquivoId: 50, nsaAnterior: 1269, nsaNovo: 1270 });
  });

  it('erro quando nao existe remessa com o NSA informado e nao consome NSA', async () => {
    headerArquivoService.findMany.mockResolvedValue([]);
    await expect(service.renovarNsaRemessa(1269, HeaderName.MODAL)).rejects.toBeInstanceOf(HttpException);
    expect(settingsService.getNextNSA).not.toHaveBeenCalled();
  });

  it('conflito quando ja ha outra remessa gerada nao enviada do mesmo tipo', async () => {
    headerArquivoService.findMany.mockResolvedValue([{ id: 50, nsa: 1269, status: HeaderArquivoStatus._3_remessaEnviado }]);
    headerArquivoService.getExists.mockResolvedValue([{ id: 51, nsa: 1268 }]);
    await expect(service.renovarNsaRemessa(1269, HeaderName.MODAL)).rejects.toBeInstanceOf(HttpException);
    expect(headerArquivoService.save).not.toHaveBeenCalled();
  });
});
