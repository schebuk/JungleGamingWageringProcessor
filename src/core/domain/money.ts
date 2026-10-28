import Decimal from 'decimal.js';

export interface MoneyProps {
  amount: string;
  currency: string;
}

export class Money {
  private readonly value: Decimal;
  public readonly currency: string;

  private constructor(value: Decimal, currency: string) {
    this.value = value;
    this.currency = currency;
  }

  static from(props: MoneyProps): Money {
    if (!props.amount || typeof props.amount !== 'string') {
      throw new Error(`Invalid money amount: ${props.amount}`);
    }
    
    const decimal = new Decimal(props.amount);
    if (decimal.isNaN() || !decimal.isFinite()) throw new Error('Invalid money amount');
    if (decimal.decimalPlaces() > 2) throw new Error('Amount must have at most 2 decimal places');
    
    return new Money(decimal, props.currency);
  }

  static zero(currency: string): Money {
    return new Money(new Decimal(0), currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    console.log(`[Money] Comparing ${this.value.toFixed(2)} < ${other.value.toFixed(2)}`);
    return this.value.lessThan(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  toJSON(): MoneyProps {
    return { amount: this.value.toFixed(2), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
  }
}