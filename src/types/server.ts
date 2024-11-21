export interface Server {
  server_id: number;
  server_name: string;
  server_image?: string;
  created_at?: string;
  channels?: Channel[];
}

export interface Channel {
  channelId: number;
  serverId: number;
  channelName: string;
  channelCategory: 'CHAT' | 'VOICE' | 'VIDEO'; // 리터럴 타입으로 정의
  channelPosition: number;
}
