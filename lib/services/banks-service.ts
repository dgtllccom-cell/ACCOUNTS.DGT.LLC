import { banksRepository } from "@/lib/repositories/banks-repository";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type BankInput = {
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
    return await banksRepository.create(input, actorId ?? null);
  }

  async update(id: string, input: Partial<BankInput>, actorId?: string | null) {
    return await banksRepository.update(id, input, actorId ?? null);
  }

  async softDelete(id: string) {
    return await banksRepository.softDelete(id);
  }
}

export const banksService = new BanksService();
