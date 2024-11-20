import { Server } from '@/types/server';
import { ApiClient } from '@/api/apiClient';

export class ServerApi {
  constructor(private apiClient: ApiClient) {}

  async createServer(name: string): Promise<Server> {
    const response = await this.apiClient.client.post('/api/v1/servers', { name });
    return response.data;
  }

  async deleteServer(serverId: number): Promise<void> {
    await this.apiClient.client.delete(`/api/v1/servers/${serverId}`);
  }

  async updateServer(serverId: number, data: Partial<Server>): Promise<Server> {
    const response = await this.apiClient.client.patch(`/api/v1/servers/${serverId}`, data);
    return response.data;
  }
}
