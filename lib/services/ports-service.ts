import { loadingPortsRepository, receivedPortsRepository, PortInput } from "@/lib/repositories/ports-repository";

export class LoadingPortsService {
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    transportType?: string | null;
    limit?: number;
    all?: boolean;
  }) {
    return await loadingPortsRepository.search(input);
  }

  async getById(id: string) {
    return await loadingPortsRepository.getById(id);
  }

  async create(input: PortInput, actorId?: string | null) {
    return await loadingPortsRepository.create(input, actorId);
  }

  async update(id: string, input: Partial<PortInput>, actorId?: string | null) {
    return await loadingPortsRepository.update(id, input, actorId);
  }

  async softDelete(id: string) {
    return await loadingPortsRepository.softDelete(id);
  }
}

export class ReceivedPortsService {
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    transportType?: string | null;
    limit?: number;
    all?: boolean;
  }) {
    return await receivedPortsRepository.search(input);
  }

  async getById(id: string) {
    return await receivedPortsRepository.getById(id);
  }

  async create(input: PortInput, actorId?: string | null) {
    return await receivedPortsRepository.create(input, actorId);
  }

  async update(id: string, input: Partial<PortInput>, actorId?: string | null) {
    return await receivedPortsRepository.update(id, input, actorId);
  }

  async softDelete(id: string) {
    return await receivedPortsRepository.softDelete(id);
  }
}

export const loadingPortsService = new LoadingPortsService();
export const receivedPortsService = new ReceivedPortsService();
