import { banksRepository } from "@/lib/repositories/banks-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

export type BankInput = {
  ownerPersonId?: string | null;
  ownerCompanyId?: string | null;
  bankType: string;
  accountType: string;
  bankName: string;
  branchName: string;
  branchCode: string;
  branchCodeType: string;
  shortName: string;
  accountTitle: string;
  accountNumber: string;
  ibanNumber?: string | null;
  currency: string;
  accountStatus: string;
  countryId?: string | null;
  stateProvinceId?: string | null;
  districtId?: string | null;
  cityId?: string | null;
  fullAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  swiftBic?: string | null;
  website?: string | null;
  remarks?: string | null;
  originalLanguage?: SupportedLanguage;
};

export class BanksService {
  async search(input: { query?: string | null; countryId?: string | null; limit?: number }) {
    return await banksRepository.search(input);
  }

  async getById(id: string) {
    return await banksRepository.getById(id);
  }

  async create(input: BankInput, actorId?: string | null) {
    const bankId = await banksRepository.create(input, actorId ?? null);
    const current = await banksRepository.getById(bankId);
    await writeRecordChangeHistory({
      recordTable: "banks",
      recordId: bankId,
      action: "create",
      actorId: actorId ?? null,
      countryId: current?.country_id ?? input.countryId ?? null,
      cityBranchId: null,
      beforeData: null,
      afterData: current ?? null
    });
    return bankId;
  }

  async update(id: string, input: Partial<BankInput>, actorId?: string | null) {
    const before = await banksRepository.getById(id);
    await banksRepository.update(id, input, actorId ?? null);
    const after = await banksRepository.getById(id);
    await writeRecordChangeHistory({
      recordTable: "banks",
      recordId: id,
      action: "update",
      actorId: actorId ?? null,
      countryId: after?.country_id ?? before?.country_id ?? null,
      cityBranchId: null,
      beforeData: before ?? null,
      afterData: after ?? null
    });
  }

  async softDelete(id: string) {
    const before = await banksRepository.getById(id);
    await banksRepository.softDelete(id);
    await writeRecordChangeHistory({
      recordTable: "banks",
      recordId: id,
      action: "delete",
      actorId: null,
      countryId: before?.country_id ?? null,
      cityBranchId: null,
      beforeData: before ?? null,
      afterData: { deleted_at: new Date().toISOString() }
    });
  }
}

export const banksService = new BanksService();
