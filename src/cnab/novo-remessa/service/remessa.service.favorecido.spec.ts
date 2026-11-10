import { dadosFavorecidoFaltantes } from './remessa.service';

/**
 * 10/11/2026: o banco rejeitou a remessa de guardadores (AO - nome do favorecido não informado) porque um favorecido com
 * conta preenchida, mas sem nome, entrou no preparo: só o código do banco era conferido.
 */
describe('dadosFavorecidoFaltantes', () => {
  const completo = { fullName: 'Fulano de Tal', bankCode: 104, bankAgency: '3766', bankAccount: '562808026', bankAccountDigit: '4' };

  it('favorecido completo não tem pendência', () => {
    expect(dadosFavorecidoFaltantes(completo)).toBeNull();
  });

  it('sem nome (nulo, vazio ou só espaços) é apontado, mesmo com os dados bancários completos', () => {
    expect(dadosFavorecidoFaltantes({ ...completo, fullName: null })).toBe('nome');
    expect(dadosFavorecidoFaltantes({ ...completo, fullName: '' })).toBe('nome');
    expect(dadosFavorecidoFaltantes({ ...completo, fullName: '   ' })).toBe('nome');
  });

  it('aponta tudo o que falta dos dados bancários', () => {
    expect(dadosFavorecidoFaltantes({ ...completo, bankCode: null, bankAgency: '', bankAccount: undefined, bankAccountDigit: ' ' })).toBe(
      'banco, agência, conta, dígito da conta',
    );
  });

  it('usuário inexistente também fica de fora', () => {
    expect(dadosFavorecidoFaltantes(undefined)).toBe('nome, banco, agência, conta, dígito da conta');
  });
});
