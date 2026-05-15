export interface ChatMessage {
  id: string;
  text: string;
  direction: 'send' | 'receive';
  timestamp: number;
}
