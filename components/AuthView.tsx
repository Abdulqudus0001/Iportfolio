import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Button from './ui/Button';
import Card from './ui/Card';

const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Sign up successful! Please check your email to confirm your account.');
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-brand-primary text-center mb-2">iPortfolio</h1>
      <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">
        {isLogin ? 'Sign in to access your dashboard' : 'Create an account to get started'}
      </p>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        <div>
          <label htmlFor="password"className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
        </Button>
        {error && <p className="text-sm text-center text-red-500">{error}</p>}
        {message && <p className="text-sm text-center text-green-500">{message}</p>}
      </form>
      <div className="mt-4 text-center">
        <button onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="text-sm text-brand-secondary hover:underline">
          {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </Card>
  );
};

export default AuthView;