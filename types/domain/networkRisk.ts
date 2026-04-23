export type NetworkRiskStatus = 'clear' | 'blocked' | 'unverified';

export type NetworkRiskSignals = {
  hosting: boolean;
  proxy: boolean;
  relay: boolean;
  tor: boolean;
  vpn: boolean;
};

export type NetworkRiskResult = {
  blocked: boolean;
  checkedAt: string;
  enforcement: 'block' | 'warn' | 'off';
  ipAddress: string | null;
  provider: 'ipinfo' | 'ipqualityscore' | 'none';
  reason: string;
  signals: NetworkRiskSignals;
  status: NetworkRiskStatus;
};
