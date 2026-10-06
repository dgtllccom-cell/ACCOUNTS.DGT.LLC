import { t } from '../lib/i18n/ui.ts';
import fs from 'fs';

console.log('Testing t directly:');
console.log('UR entry_register:', t('ur', 'nav.entry_register'));
console.log('UR enterprise_audit:', t('ur', 'nav.enterprise_audit_monitoring'));
console.log('AR entry_register:', t('ar', 'nav.entry_register'));
console.log('FA entry_register:', t('fa', 'nav.entry_register'));
console.log('PS entry_register:', t('ps', 'nav.entry_register'));
