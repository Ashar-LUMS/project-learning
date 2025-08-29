import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Make sure this path is correct
//import { data } from 'react-router-dom';

// Use a type that matches the user object returned by Supabase
interface User {
  id: string;
  email: string;
  user_metadata: {
    name?: string;
    roles?: Array<string>;
  };
}

const TestPage = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. Initial check for an existing session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user as User);
      }
    };
    getInitialSession();

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as User ?? null);
    });

    // 3. Cleanup the subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return <div>No user found. Please log in.</div>;
  }

  return (
    <div>
      <h2>User Profile</h2>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Name:</strong> {user.user_metadata.name ?? 'N/A'}
      </p>
      <p>
        <strong>Roles:</strong> {user.user_metadata.roles?.join(', ') ?? 'N/A'}
      </p>
      <p>{JSON.stringify(user)}</p>
    </div>
  );
};
export default TestPage;