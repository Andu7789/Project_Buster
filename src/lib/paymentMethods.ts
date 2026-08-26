import type { PaymentMethodType } from '../types'

export const paymentMethods: PaymentMethodType[] = ['bank', 'wise', 'paypal']

export const paymentMethodLabel: Record<PaymentMethodType, string> = {
  bank: 'UK Bank Transfer',
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
    { key: 'email', label: 'Email' },
    { key: 'fullName', label: 'Full name' },
    { key: 'mobileAccountNumber', label: 'Mobile account number' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'recipientAddress', label: 'Recipient address' },
    { key: 'postalCode', label: 'Postal code' },
  ],
  paypal: [{ key: 'email', label: 'PayPal email' }],
}
