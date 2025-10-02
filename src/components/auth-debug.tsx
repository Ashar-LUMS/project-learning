import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useRole } from '../getRole';

interface AuthDebugInfo {
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  roles: string[] | null;
  isLocked: boolean | null;
  sessionExpiry: string | null;
  lastRefresh: string | null;
}

export const AuthDebug = () => {
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo>({
    hasSession: false,
    userId: null,
    email: null,
    roles: null,
    isLocked: null,
    sessionExpiry: null,
    lastRefresh: null
  });
  
  const { roles, isLoading, isLocked } = useRole();

  useEffect(() => {
    const updateDebugInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      
      setDebugInfo({
        hasSession: !!session,
        userId: user?.id || null,
        email: user?.email || null,
        roles: roles,
        isLocked: isLocked,
        sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : null,
        lastRefresh: session?.refresh_token ? 'Available' : 'None'
      });
    };

    updateDebugInfo();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      updateDebugInfo();
    });

    return () => subscription.unsubscribe();
  }, [roles, isLocked]);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg text-xs font-mono shadow-lg max-w-xs z-50">
      <div className="font-bold mb-2">Auth Debug</div>
      <div>Session: {debugInfo.hasSession ? '✅' : '❌'}</div>
      <div>User ID: {debugInfo.userId ? `${debugInfo.userId.slice(0, 8)}...` : 'None'}</div>
      <div>Email: {debugInfo.email || 'None'}</div>
      <div>Roles: {debugInfo.roles?.join(', ') || 'None'}</div>
      <div>Locked: {isLoading ? '⏳' : (debugInfo.isLocked ? '🔒' : '🔓')}</div>
      <div>Expires: {debugInfo.sessionExpiry || 'None'}</div>
      <div>Refresh: {debugInfo.lastRefresh || 'None'}</div>
    </div>
  );
};