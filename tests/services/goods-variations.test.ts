import { describe, expect, it, vi } from "vitest";
import { goodsService } from "@/lib/services/goods-service";
import { goodsRepository } from "@/lib/repositories/goods-repository";

vi.mock("@/lib/repositories/goods-repository", () => {
  return {
    goodsRepository: {
      checkChsCodeExists: vi.fn(),
      create: vi.fn(),
      createVariation: vi.fn()
    }
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    createSupabaseAdminClient: vi.fn(() => ({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn(() => ({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        })),
        insert: vi.fn(() => ({
          error: null
        }))
      }))
    }))
  };
});

describe("Goods variations service layer", () => {
  it("prevents registering duplicate CHS codes", async () => {
    vi.mocked(goodsRepository.checkChsCodeExists).mockResolvedValueOnce(true);

    await expect(
      goodsService.create({
        chsCode: "0802.12.00",
        goodsName: "Almonds",
        originalLanguage: "en"
      })
    ).rejects.toThrow('CHS Code "0802.12.00" is already in use.');

    expect(goodsRepository.checkChsCodeExists).toHaveBeenCalledWith("0802.12.00");
  });

  it("calls repository correctly when CHS code is unique", async () => {
    vi.mocked(goodsRepository.checkChsCodeExists).mockResolvedValueOnce(false);
    vi.mocked(goodsRepository.create).mockResolvedValueOnce("mocked-goods-id");

    const goodsId = await goodsService.create(
      {
        chsCode: "0802.12.00",
        goodsName: "Almonds",
        originalLanguage: "en"
      },
      "actor-123"
    );

    expect(goodsId).toBe("mocked-goods-id");
    expect(goodsRepository.create).toHaveBeenCalledWith({
      chsCode: "0802.12.00",
      goodsName: "Almonds",
      originalLanguageCode: "en",
      createdBy: "actor-123"
    });
  });

  it("creates variations successfully", async () => {
    vi.mocked(goodsRepository.createVariation).mockResolvedValueOnce("mocked-variation-id");

    const variationId = await goodsService.createVariation(
      {
        goodsId: "mocked-goods-id",
        originCountryId: "country-id-abc",
        size: "22/24",
        brand: "Brand A"
      },
      "actor-123"
    );

    expect(variationId).toBe("mocked-variation-id");
    expect(goodsRepository.createVariation).toHaveBeenCalledWith({
      goodsId: "mocked-goods-id",
      originCountryId: "country-id-abc",
      size: "22/24",
      brand: "Brand A",
      createdBy: "actor-123"
    });
  });
});
