import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/stores/login';
import { useMemberStore } from '@/stores/memberStore';
import SocialLoginButton from '@/components/Login/SocialLoginButton';
import RegisterMember from '@/components/Login/RegisterMember';

const LoginForm: React.FC = () => {
  const { email, password, setEmail, setPassword, login } = useStore();
  const navigate = useNavigate();
  const { openRegister } = useMemberStore(); // 팝업 여는 함수

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await login();
    if (success) {
      navigate('/home');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-3 rounded-xl bg-discord800">
        <h1 className="text-2xl font-bold text-center text-kakaoYellow">PITCHING</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
               focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="이메일을 입력해주세요"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-discord700 text-white border-discord600
               focus:border-yellow-300 focus:ring-yellow-300 focus:outline-none"
              placeholder="비밀번호를 입력해주세요"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 font-medium text-kakaoBrown bg-kakaoYellow rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-kakaoBrown"
          >
            로그인
          </button>
        </form>

        {/* 아이디 찾기 | 비밀번호 찾기 | 회원가입 링크 */}
        <div className="mb-0 mt-0 flex justify-end text-sm text-gray-500">
          <a href="#" className="hover:underline">
            아이디 찾기
          </a>
          <span className="px-2">|</span>
          <a href="#" className="hover:underline">
            비밀번호 찾기
          </a>
          <span className="px-2">|</span>
          <a href="#" className="hover:underline" onClick={openRegister}>
            회원가입
          </a>
        </div>

        <div className="mt-6 pt-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-discord600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-400">간편 로그인</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <SocialLoginButton provider="google" />
            <SocialLoginButton provider="naver" />
            <SocialLoginButton provider="kakao" />
          </div>
        </div>
      </div>
      <RegisterMember /> {/* 회원가입 팝업 컴포넌트 */}
    </div>
  );
};

export default LoginForm;
