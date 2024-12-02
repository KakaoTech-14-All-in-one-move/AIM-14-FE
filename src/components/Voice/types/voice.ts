export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface UserState {
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}