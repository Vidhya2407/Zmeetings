export type TotpStage = 'idle' | 'scanning' | 'verifying' | 'active';
export type SmsStage = 'idle' | 'entering' | 'verifying' | 'active';
export type BackupStage = 'idle' | 'generating' | 'ready';

export const mockSecuritySecret = 'JBSWY3DPEHPK3PXP';
export const mockBackupCodes = ['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6', 'Q7R8-S9T0', 'U1V2-W3X4', 'Y5Z6-A7B8', 'C9D0-E1F2'] as const;


