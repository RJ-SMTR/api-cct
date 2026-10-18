import {
  CONSORCIOS_BILHETAGEM,
  LinhaResumo,
  MODAIS_BILHETAGEM,
  descreverMotivo,
  montarResumo,
  sqlNormalizarGrupo,
} from './dashboard-pagamentos.utils';

describe('dashboard de pagamentos - regras puras', () => {
  describe('descreverMotivo', () => {
    it('usa a descrição CNAB para códigos de ocorrência e as customizadas do sistema', () => {
      expect(descreverMotivo('ANHO')).toBe('Conta digital');
      expect(descreverMotivo('PENDENCIA_PAGA')).toBe('Pendência paga');
      expect(descreverMotivo('ENVIADO')).toBe('Enviado ao banco (aguardando retorno)');
    });

    it('nunca deixa o motivo sem texto', () => {
      expect(descreverMotivo(null)).toBe('Motivo não informado pelo banco');
      expect(descreverMotivo('')).toBe('Motivo não informado pelo banco');
      expect(descreverMotivo('ZZ')).toBe('Código ZZ');
    });
  });

  describe('sqlNormalizarGrupo', () => {
    it('cobre todos os consórcios e modais pedidos e junta MOBI-Rio BUM em MobiRio', () => {
      const sql = sqlNormalizarGrupo('op."nomeConsorcio"');
      for (const nome of [...CONSORCIOS_BILHETAGEM, ...MODAIS_BILHETAGEM]) {
        expect(sql).toContain(`THEN '${nome}'`);
      }
      expect(sql).toContain("WHEN 'MOBI-RIO BUM' THEN 'MobiRio'");
      expect(sql).toContain("'Outros'");
    });
  });

  describe('montarResumo', () => {
    const linhas: LinhaResumo[] = [
      { conta: 'bilhetagem', grupo: 'VLT', situacao: 'pago', motivo: 'EFETIVADO', qtd: '10', valor: '1000.50' },
      { conta: 'bilhetagem', grupo: 'VLT', situacao: 'pago', motivo: 'PENDENCIA_PAGA', qtd: 2, valor: 200 },
      { conta: 'bilhetagem', grupo: 'VLT', situacao: 'naoPago', motivo: '02', qtd: 1, valor: 50 },
      { conta: 'bilhetagem', grupo: 'STPL', situacao: 'naoPago', motivo: null, qtd: 3, valor: 30 },
      { conta: 'bilhetagem', grupo: 'STPL', situacao: 'emAberto', motivo: 'ENVIADO', qtd: 4, valor: 400 },
      { conta: 'bilhetagem', grupo: 'Estranho', situacao: 'pago', motivo: 'EFETIVADO', qtd: 1, valor: 5 },
      { conta: 'rotativo', grupo: 'Guardador', situacao: 'pago', motivo: 'EFETIVADO', qtd: 7, valor: 70 },
      { conta: 'cett', grupo: 'Pagamento único', situacao: 'emAberto', motivo: 'ENVIADO', qtd: 2, valor: 2000 },
    ];

    const resumo = montarResumo(linhas);
    const bilhetagem = resumo.find((c) => c.conta === 'bilhetagem')!;

    it('devolve as três contas, na ordem Bilhetagem, Rotativo e CETT', () => {
      expect(resumo.map((c) => c.conta)).toEqual(['bilhetagem', 'rotativo', 'cett']);
      expect(resumo.map((c) => c.nome)).toEqual(['Conta Bilhetagem', 'Conta Rotativo', 'Conta CETT']);
    });

    it('mostra todos os 8 consórcios e 3 modais da Bilhetagem, mesmo sem pagamentos', () => {
      const nomes = bilhetagem.grupos.map((g) => g.grupo);
      for (const nome of [...CONSORCIOS_BILHETAGEM, ...MODAIS_BILHETAGEM]) expect(nomes).toContain(nome);
      expect(bilhetagem.grupos.find((g) => g.grupo === 'GTU')!.pago).toEqual({ qtd: 0, valor: 0 });
    });

    it('soma pago, não pago e em aberto por grupo e no total da conta', () => {
      const vlt = bilhetagem.grupos.find((g) => g.grupo === 'VLT')!;
      expect(vlt.pago).toEqual({ qtd: 12, valor: 1200.5 });
      expect(vlt.naoPago).toEqual({ qtd: 1, valor: 50 });
      expect(bilhetagem.pago).toEqual({ qtd: 13, valor: 1205.5 });
      expect(bilhetagem.naoPago).toEqual({ qtd: 4, valor: 80 });
      expect(bilhetagem.emAberto).toEqual({ qtd: 4, valor: 400 });
    });

    it('detalha os motivos, com descrição, ordenados por situação e quantidade', () => {
      const naoPago = bilhetagem.motivos.filter((m) => m.situacao === 'naoPago');
      expect(naoPago.map((m) => m.codigo)).toEqual(['SEM_MOTIVO', '02']);
      expect(naoPago[0].descricao).toBe('Motivo não informado pelo banco');
      expect(bilhetagem.grupos.find((g) => g.grupo === 'STPL')!.motivos.map((m) => m.codigo)).toEqual(['SEM_MOTIVO', 'ENVIADO']);
    });

    it('mantém grupos inesperados no fim, sem perder o valor', () => {
      expect(bilhetagem.grupos[bilhetagem.grupos.length - 1].grupo).toBe('Estranho');
      expect(bilhetagem.pago.qtd).toBe(13);
    });

    it('Rotativo tem só o grupo Guardador e CETT tem os modais e o pagamento único', () => {
      expect(resumo[1].grupos.map((g) => g.grupo)).toEqual(['Guardador']);
      expect(resumo[2].grupos.map((g) => g.grupo)).toEqual(['STPC', 'STPL', 'TEC', 'Pagamento único']);
      expect(resumo[2].emAberto).toEqual({ qtd: 2, valor: 2000 });
    });
  });
});
