import { resolveStucPaymentWindow, resolveStucWindowDays } from './stuc-payment-window.util';

describe('resolveStucPaymentWindow', () => {
  // 2026-10-23 é sexta-feira; a janela sexta-segunda dessa semana vai até 2026-10-26.
  const sexta = new Date(2026, 9, 23);
  const sabado = new Date(2026, 9, 24);
  const domingo = new Date(2026, 9, 25);
  const segunda = new Date(2026, 9, 26);
  // 2026-10-27 é terça-feira da semana seguinte; janela terça-quinta vai até 2026-10-29.
  const terca = new Date(2026, 9, 27);
  const quarta = new Date(2026, 9, 28);
  const quinta = new Date(2026, 9, 29);

  it('coloca sexta-feira no dia 0 da janela de pagamento', () => {
    expect(resolveStucPaymentWindow(sexta).dayIndex).toBe(0);
  });

  it('coloca sábado da mesma janela no dia 1, com o mesmo windowKey da sexta', () => {
    const resultadoSexta = resolveStucPaymentWindow(sexta);
    const resultadoSabado = resolveStucPaymentWindow(sabado);
    expect(resultadoSabado.dayIndex).toBe(1);
    expect(resultadoSabado.windowKey).toBe(resultadoSexta.windowKey);
  });

  it('coloca domingo e segunda da mesma janela nos dias 2 e 3, com o mesmo windowKey', () => {
    const resultadoSexta = resolveStucPaymentWindow(sexta);
    const resultadoDomingo = resolveStucPaymentWindow(domingo);
    const resultadoSegunda = resolveStucPaymentWindow(segunda);
    expect(resultadoDomingo.dayIndex).toBe(2);
    expect(resultadoDomingo.windowKey).toBe(resultadoSexta.windowKey);
    expect(resultadoSegunda.dayIndex).toBe(3);
    expect(resultadoSegunda.windowKey).toBe(resultadoSexta.windowKey);
  });

  it('coloca terça-feira no dia 0 de uma janela diferente da de sexta-segunda', () => {
    const resultadoSexta = resolveStucPaymentWindow(sexta);
    const resultadoTerca = resolveStucPaymentWindow(terca);
    expect(resultadoTerca.dayIndex).toBe(0);
    expect(resultadoTerca.windowKey).not.toBe(resultadoSexta.windowKey);
  });

  it('coloca quarta e quinta da mesma janela de terça nos dias 1 e 2, com o mesmo windowKey', () => {
    const resultadoTerca = resolveStucPaymentWindow(terca);
    const resultadoQuarta = resolveStucPaymentWindow(quarta);
    const resultadoQuinta = resolveStucPaymentWindow(quinta);
    expect(resultadoQuarta.dayIndex).toBe(1);
    expect(resultadoQuarta.windowKey).toBe(resultadoTerca.windowKey);
    expect(resultadoQuinta.dayIndex).toBe(2);
    expect(resultadoQuinta.windowKey).toBe(resultadoTerca.windowKey);
  });

  it('dá windowKey diferente para a segunda de uma semana e a terça da semana seguinte', () => {
    const resultadoSegunda = resolveStucPaymentWindow(segunda);
    const resultadoTerca = resolveStucPaymentWindow(terca);
    expect(resultadoSegunda.windowKey).not.toBe(resultadoTerca.windowKey);
  });

  it('mantém um único windowKey numa janela que cruza a troca de mês', () => {
    // 2026-10-30 é sexta-feira; a janela vai até 2026-11-02 (segunda), cruzando out/nov.
    const sextaFimDeMes = new Date(2026, 9, 30);
    const segundaInicioDeMes = new Date(2026, 10, 2);
    const resultadoSexta = resolveStucPaymentWindow(sextaFimDeMes);
    const resultadoSegunda = resolveStucPaymentWindow(segundaInicioDeMes);
    expect(resultadoSegunda.dayIndex).toBe(3);
    expect(resultadoSegunda.windowKey).toBe(resultadoSexta.windowKey);
  });
});

describe('resolveStucWindowDays', () => {
  it('devolve as 4 datas sexta-segunda, na ordem do dayIndex, para um pagamento de terça', () => {
    const terca = new Date(2026, 9, 27);
    const sexta = new Date(2026, 9, 23);
    const sabado = new Date(2026, 9, 24);
    const domingo = new Date(2026, 9, 25);
    const segunda = new Date(2026, 9, 26);

    expect(resolveStucWindowDays(terca)).toEqual([sexta, sabado, domingo, segunda]);
  });

  it('devolve as 3 datas terça-quinta, na ordem do dayIndex, para um pagamento de sexta', () => {
    const sexta = new Date(2026, 9, 30);
    const terca = new Date(2026, 9, 27);
    const quarta = new Date(2026, 9, 28);
    const quinta = new Date(2026, 9, 29);

    expect(resolveStucWindowDays(sexta)).toEqual([terca, quarta, quinta]);
  });

  it('lança erro para uma data de pagamento que não é terça nem sexta', () => {
    const quarta = new Date(2026, 9, 28);
    expect(() => resolveStucWindowDays(quarta)).toThrow();
  });
});
