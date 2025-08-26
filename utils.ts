import { Currency } from './types';

export const getCurrencySymbol = (currency: Currency | undefined): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'JPY': return '¥';
        case 'INR': return '₹';
        case 'NGN': return '₦';
        case 'QAR': return 'QR';
        case 'SAR': return 'SR';
        default: return '$';
    }
}