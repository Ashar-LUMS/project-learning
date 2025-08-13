import { useState } from 'react';
import { z } from 'zod';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { supabase } from '../../supabaseClient.ts';


// 1. Define the Zod schema for the form data
const loginSchema = z.object({
  email: z.email({
    message: "Please enter a valid email address."
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters."
  }),
});

interface LoginProps {
  heading?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  buttonText?: string;
  googleText?: string;
  signupText?: string;
  signupUrl?: string;
}

const Login = ({
  heading = "Login",
  logo = {
    url: "https://tison.lums.edu.pk",
    src: "https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png",
    alt: "logo",
    title: "TISON",
  },
  buttonText = "Login",
  signupText = "Need an account?",
  signupUrl = "/signup",
}: LoginProps) => {

  // 2. Use state to manage the form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 3. Use state to manage validation errors
  const [errors, setErrors] = useState({ email: '', password: '' });

  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // 4. Create a function to handle form submission
  // Add `async` to the function
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const result = loginSchema.safeParse({ email, password });

  if (result.success) {
    setErrors({ email: 'field input accepted', password: 'field input accepted' });

    // Use Supabase to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Handle Supabase errors, e.g., display a message to the user
      console.error(error.message);
      // You could set an error state here to show a message
      // setErrors({ ...errors, general: error.message });
    } else if (data.user) {
      console.log("Login successful!", data.user);
      navigate('/app');
    }
  }
};


  return (
    <section className="bg-muted h-screen">
      <div className="flex h-full items-center justify-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <a href={logo.url}>
            <img
              src={logo.src}
              alt={logo.alt}
              title={logo.title}
              className="h-10 dark:invert"
            />
          </a>
          <div className="min-w-sm border-muted bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
            {heading && <h1 className="text-xl font-semibold">{heading}</h1>}
            {/* 5. Wrap inputs and button in a <form> tag */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-y-4">
              {/* 6. Connect inputs to state and add error messages */}
              <Input
                type="email"
                placeholder="Email"
                className="text-md"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <p className="text-red-500 text-sm text-left">{errors.email}</p>}
              
              <Input
                type="password"
                placeholder="Password"
                className="text-md"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <p className="text-red-500 text-sm text-left">{errors.password}</p>}
              
              {/* 7. The button type is submit*/}
              <Button type="submit" className="w-full">
                {buttonText}
              </Button>
            </form>
          </div>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{signupText}</p>
            <Link
              to={signupUrl}
              className="text-primary font-medium hover:underline"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Login };