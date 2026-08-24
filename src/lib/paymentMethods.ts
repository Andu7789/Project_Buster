import type { PaymentMethodType } from '../types'

export const paymentMethods: PaymentMethodType[] = ['bank', 'wise', 'paypal']

export const paymentMethodLabel: Record<PaymentMethodType, string> = {
  bank: 'Bank transfer',
  wise: 'WISE',
  paypal: 'PayPal',
}

export const paymentMethodFields: Record<PaymentMethodType, { key: string; label: string }[]> = {
  bank: [
    { key: 'accountName', label: 'Account holder name' },
    { key: 'bankName', label: 'Bank name' },
    { key: 'accountNumber', label: 'Account number' },
    { key: 'sortCode', label: 'Sort code' },
    { key: 'iban', label: 'IBAN' },
    { key: 'swiftBic', label: 'SWIFT / BIC' },
  ],
  wise: [
    { key: 'accountName', label: 'Account holder name' },
    { key: 'email', label: 'WISE email' },
    { key: 'accountNumber', label: 'Account number / IBAN' },
    { key: 'phoneNumber', label: 'Phone number' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'postalCode', label: 'Postal code' },
  ],
  paypal: [{ key: 'email', label: 'PayPal email' }],
}
