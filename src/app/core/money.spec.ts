import { amountToApi, direction, fromPaise, inr, paise, percent, signedInr } from './money';

describe('money', () => {
  it('groups digits the Indian way', () => {
    expect(inr('145000.5')).toBe('₹1,45,000.50');
    expect(inr('10000000')).toBe('₹1,00,00,000.00');
    expect(inr('999.999')).toBe('₹1,000.00');
    expect(inr('1450', true)).toBe('₹1,450');
  });

  it('shows a dash rather than NaN for missing values', () => {
    expect(inr(undefined)).toBe('–');
    expect(inr('')).toBe('–');
    expect(inr('abc')).toBe('–');
    expect(signedInr(null)).toBe('–');
  });

  it('never shows a change by colour alone: a sign and an arrow', () => {
    expect(signedInr('1200')).toBe('+₹1,200.00 ▲');
    expect(signedInr('-35')).toBe('−₹35.00 ▼');
    expect(signedInr('0')).toBe('₹0.00');
    expect(percent(1.234)).toBe('+1.23%');
    expect(percent(-0.5)).toBe('−0.50%');
    expect(percent(0)).toBe('0.00%');
  });

  it('picks the colour class from the sign', () => {
    expect(direction('3')).toBe('gain');
    expect(direction('-3')).toBe('loss');
    expect(direction('0')).toBe('');
    expect(direction(null)).toBe('');
  });

  it('turns what a person typed into the string the API wants, or refuses it', () => {
    expect(amountToApi('1,500')).toBe('1500.00');
    expect(amountToApi('₹ 99.5')).toBe('99.50');
    expect(amountToApi('007')).toBe('7.00');
    expect(amountToApi('12.345')).toBeNull();
    expect(amountToApi('-5')).toBeNull();
    expect(amountToApi('')).toBeNull();
    expect(amountToApi('1e5')).toBeNull();
  });

  it('sums in whole paise so a total never drifts', () => {
    expect(paise('0.1') + paise('0.2')).toBe(30);
    expect(fromPaise(paise('0.1') + paise('0.2'))).toBe('0.30');
    expect(paise(1450.05)).toBe(145005);
    expect(paise(undefined)).toBe(0);
    expect(fromPaise(-3505)).toBe('-35.05');
    expect(fromPaise(7)).toBe('0.07');
    expect(signedInr(fromPaise(-3505))).toBe('−₹35.05 ▼');
  });
});
