import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemberStore } from '@/stores/memberStore';
import { useAuth } from '@/hooks/useAuth';  // useAuth import
import SocialLoginButton from '@/components/Login/SocialLoginButton';
import RegisterMember from '@/components/Login/RegisterMember';

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading } = useAuth();  // useAuth 사용
    const navigate = useNavigate();
    const { openRegister } = useMemberStore();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await login({ email, password });
            // useAuth 내부에서 자동으로 navigate 처리됨
        } catch (error) {
            // 에러는 useAuth 내부에서 처리됨
            console.error('Login failed:', error);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-3 rounded-xl bg-discord700">
                <h1 className="text-2xl font-bold text-center text-kakaoYellow">PITCHING</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1 pt-3">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md bg-discord500 text-white border-discord500
               focus:border-kakaoYellow focus:ring-kakaoYellow focus:outline-none"
                            placeholder="이메일"
                        />
                    </div>

                    <div className="space-y-1">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md bg-discord500 text-white border-discord500
               focus:border-kakaoYellow focus:ring-kakaoYellow focus:outline-none"
                            placeholder="비밀번호"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-2 font-bold text-kakaoBrown bg-kakaoYellow rounded-md 
                                 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-kakaoBrown
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                </form>

                <div className="mt-6">
                    <button
                        type="button"
                        onClick={openRegister}
                        className="w-full px-4 py-2 font-medium text-kakaoYellow rounded-md border border-kakaoYellow hover:text-kakaoYellow focus:outline-none focus:ring-2"
                    >
                        회원가입
                    </button>
                </div>

                <div className="mt-6 pt-2">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-500"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 text-gray-400 bg-discord700">간편 로그인</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <SocialLoginButton provider="kakao" />
                        <SocialLoginButton provider="google" />
                        <SocialLoginButton provider="naver" />
                    </div>
                </div>
            </div>
            <RegisterMember />
        </div>
    );
};

export default LoginForm;