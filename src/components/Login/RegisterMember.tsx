import React from 'react';
import { useMemberStore } from '@/stores/memberStore';

const RegisterMember: React.FC = () => {
  const { isRegisterOpen, closeRegister } = useMemberStore();

  if (!isRegisterOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="w-full max-w-md p-8 space-y-6 rounded-xl bg-discord800">
        <h2 className="text-2xl font-bold text-center text-kakaoYellow">회원가입</h2>
        <form className="space-y-6 mt-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">이메일</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
                     focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="이메일을 입력하세요"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">비밀번호</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
                     focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="비밀번호를 입력하세요"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">비밀번호 확인</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
                     focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="비밀번호를 다시 입력하세요"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">닉네임</label>
            <input
              type="username"
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
                     focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="닉네임을 입력하세요"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 font-medium text-kakaoBrown bg-kakaoYellow rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-kakaoBrown"
          >
            회원가입
          </button>
        </form>

        <button
          onClick={closeRegister}
          className="mt-4 w-full py-2 text-sm text-gray-500 hover:underline"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default RegisterMember;
