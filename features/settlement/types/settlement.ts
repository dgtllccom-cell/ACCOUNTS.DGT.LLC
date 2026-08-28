export type SettlementStatus = 
  | 'settled' 
  | 'partially_settled' 
  | 'unsettled' 
  | 'difference' 
  | 'needs_review';

export type SettlementDirection = 'cr' | 'dr';

export type SettlementTransaction = {
  id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  country_name?: string;
  branch_name?: string;
  city_branch_name?: string;
  source_module: string;
  source_table: string;
  source_id: string;
  source_reference_no: string | null;
  source_date: string;
  direction: SettlementDirection;
  settlement_type: string;
  local_currency: string;
  local_amount: number;
  original_usd_rate: number;
  original_usd_amount: number;
  settlement_status: SettlementStatus;
  settled_local_amount: number;
  settled_usd_amount: number;
  remaining_local: number;
  remaining_usd: number;
  party_name: string | null;
  party_account_no: string | null;
  narration: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SettlementLink = {
  id: string;
  cr_settlement_id: string;
  dr_settlement_id: string;
  linked_local_amount: number;
  linked_usd_amount: number;
  cr_usd_rate: number;
  dr_usd_rate: number;
  fx_difference_local: number;
  fx_difference_usd: number;
  fx_direction: 'gain' | 'loss' | 'neutral';
  settlement_date: string;
  settled_by: string | null;
  remarks: string | null;
  is_auto_matched: boolean;
  created_at: string;
  cr_reference_no?: string;
  dr_reference_no?: string;
  cr_party?: string;
  dr_party?: string;
  currency?: string;
};

export type SettlementKPIs = {
  totalCrLocal: number;
  totalDrLocal: number;
  totalCrUsd: number;
  totalDrUsd: number;
  remainingCrLocal: number;
  remainingDrLocal: number;
  remainingCrUsd: number;
  remainingDrUsd: number;
  countSettled: number;
  countPartial: number;
  countUnsettled: number;
  countFlagged: number;
  totalFxGainUsd: number;
  totalFxLossUsd: number;
  netFxUsd: number;
};

export type SettlementDailySummary = {
  country_id: string;
  country_name: string;
  country_currency: string;
  country_branch_id: string;
  branch_name: string;
  city_branch_id: string;
  city_branch_name: string;
  txn_date: string;
  local_currency: string;
  total_entries: number;
  total_cr_local: number;
  total_dr_local: number;
  total_cr_usd: number;
  total_dr_usd: number;
  remaining_cr_local: number;
  remaining_dr_local: number;
  remaining_cr_usd: number;
  remaining_dr_usd: number;
  count_settled: number;
  count_partial: number;
  count_unsettled: number;
  count_review: number;
  count_flagged: number;
  total_fx_gain_usd: number;
  total_fx_loss_usd: number;
};

export type SettlementException = {
  id: string;
  country_id: string;
  country_branch_id: string;
  city_branch_id: string;
  source_module: string;
  source_reference_no: string;
  source_date: string;
  direction: SettlementDirection;
  local_currency: string;
  local_amount: number;
  remaining_local: number;
  remaining_usd: number;
  settlement_status: SettlementStatus;
  party_name: string;
  party_account_no: string;
  is_flagged: boolean;
  flag_reason: string;
  exception_type: string;
  days_outstanding: number;
  created_at: string;
};
