import { useState } from 'react';
import { z } from 'zod';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { supabase } from '../../supabaseClient.ts';

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
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 3. Use state to manage validation errors
  const [errors, setErrors] = useState({ email: '', password: '', general: '' });

  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // 4. Create a function to handle form submission
  // Add `async` to the function
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (isSubmitting) return;
  setIsSubmitting(true);

  const result = loginSchema.safeParse({ email, password });

  if (result.success) {
    setErrors({ email: '', password: '', general: '' });

    // Use Supabase to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Handle Supabase errors, e.g., display a message to the user
      console.error(error.message);
      setErrors({ email: '', password: '', general: error.message });
      setIsSubmitting(false);
      return;
    } else if (data.user) {
      console.log("Login successful!", data);
      navigate('/app');
      setIsSubmitting(false);
    }
  }
  else if (result.error) {
    const fieldErrors: { email?: string; password?: string } = {};
    result.error.issues.forEach((issue) => {
      if (issue.path[0] === "email") fieldErrors.email = issue.message;
      if (issue.path[0] === "password") fieldErrors.password = issue.message;
    });
    setErrors({ email: fieldErrors.email || '', password: fieldErrors.password || '', general: '' });
    setIsSubmitting(false);
  }
};


  return (
    <section className="bg-muted min-h-screen">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <a href={logo.url}>
            <img
              src={logo.src}
              alt={logo.alt}
              title={logo.title}
              className="h-10 dark:invert"
            />
          </a>

          <Card className="w-[380px]">
            <CardHeader className="text-center">
              {heading && <CardTitle className="text-xl">{heading}</CardTitle>}
              <CardDescription>Welcome back. Please sign in to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <p className="text-sm text-red-600" role="alert" aria-live="polite">{errors.general}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-red-600 text-xs">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => navigate('/forgot-password')}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={!!errors.password}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-600 text-xs">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="animate-spin" /> Signing in...</>) : buttonText}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{signupText}</p>
            <Link to={signupUrl} className="text-primary font-medium hover:underline">Sign up</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Login };