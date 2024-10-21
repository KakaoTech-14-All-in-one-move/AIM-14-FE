import { create } from 'zustand';

interface Message {
  id: string;
  profileImage: string;
  author: string;
  content: string;
  timestamp: string;
}

interface MessageStore {
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
}

const defaultMessages: Message[] = [
  {
    id: '1',
    author: 'david.lee(이찬영)',
    profileImage: '/images/google_login_logo.png',
    content: '감사합니다 🙂',
    timestamp: '2024-10-17T06:33:00Z',
  },
  {
    id: '2',
    author: 'teddy.kim(김영진)',
    profileImage: '/images/kakao_login_logo.png',
    content:
      '저희 피그마 누가 요청한 것 같은데, 아시는 분 계시면 Approve나 Deny 눌러주세요! (x 버튼 누르면 자동으로 Deny 될까봐 못 누르는 중..)',
    timestamp: '2024-10-17T07:32:00Z',
  },
  {
    id: '3',
    author: 'Ella.kim(김혜현)',
    profileImage: '/images/naver_login_logo.png',
    content: 'Deny하죠',
    timestamp: '2024-10-17T07:33:00Z',
  },
];

const useMessageStore = create<MessageStore>((set) => ({
  messages: defaultMessages,
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        },
      ],
    })),
}));

export default useMessageStore;
