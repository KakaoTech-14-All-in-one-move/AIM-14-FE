import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/stores/login';
import SocialLoginButton from '@/components/Login/SocialLoginButton';

const LoginForm: React.FC = () => {
    const { username, password, setEmail, setPassword, login } = useStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const success = await login();
        if (success) {
            navigate('/home');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-3 rounded-xl bg-gray-800">
                <h1 className="text-2xl font-bold text-center text-kakaoYellow">PITCHING</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white border-gray-600 focus:border-blue-300"
                            placeholder="Please enter your email"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white border-gray-600 focus:border-blue-300"
                            placeholder="Please enter your password"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 font-medium text-kakaoBrown bg-kakaoYellow rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-kakaoBrown"
                    >
                        LOGIN
                    </button>
                </form>
                <div className="text-sm text-center">
                    <a href="#" className="text-yellow-400 hover:underline">
                        I've forgotten my password
                    </a>
                </div>
                <div className="mt-6 pt-2">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 text-gray-400 bg-gray-800">간편 로그인</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <SocialLoginButton provider="google" />
                        <SocialLoginButton provider="naver" />
                        <SocialLoginButton provider="kakao" />
                    </div>
                </div>
            </div>
        </div >
    );
};

export default LoginForm;
