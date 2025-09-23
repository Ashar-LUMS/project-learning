import { useState } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
// import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.ts';

const AVAILABLE_ROLES: string[] =(import.meta.env.VITE_ROLES ?? 'Dummy').split(',');

// 1. Define the Zod schema for the form data
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  //roles: z.string().min(1, { message: "Minimum of 1 role is required." })
  roles: z.array(z.string()).min(1, { message: "Select at least one role." })
});

interface SignupProps {
  heading?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  buttonText?: string;
  signupText?: string;
  loginUrl?: string;
}

const Signup = ({
  heading = "Sign Up",
  logo = {
    url: "https://tison.lums.edu.pk",
    src: "https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png",
    alt: "logo",
    title: "TISON",
  },
  buttonText = "Sign Up",
  signupText = "Already have an account?",
  loginUrl = "/",
}: SignupProps) => {
  // 2. Use state to manage the form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]); 

  // 3. Use state to manage validation errors
  const [errors, setErrors] = useState({ name: '', email: '', password: '', roles: '', general: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Toggle checkbox handler
  const toggleRole = (role: string) => {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  // 4. Create a function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrors({ name: '' , email: '' , password: '' , roles: '' , general: '' }); // Clear previous errors

    // Pass 'roles' to safeParse to validate all fields
    const result = signupSchema.safeParse({ name, email, password, roles });

    if (!result.success) {
      // **Added:** Detailed logging for Zod validation errors
      console.error("Form validation failed:", result.error); 

      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0] || '',
        email: fieldErrors.email?.[0] || '',
        password: fieldErrors.password?.[0] || '',
        roles: fieldErrors.roles?.[0] || '',
        general: '', 
      });
      console.log(errors);
      setIsSubmitting(false);
      return; // Stop the function if validation fails
    }

  if (result.success) {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, roles, isLocked: false, redirectTo: "" }
      }
    });
console.log(signUpData);
console.log(signUpError);
    if (signUpError) {
      console.error("Supabase sign-up error:", signUpError.message);
      // Specific handling for "already registered" error
  if (signUpError.message.toLowerCase().includes("already registered")) {
    setErrors({ ...errors, general: "This email is already in use. Please log in instead." });
    setIsSubmitting(false);
    return;
  }
      setErrors({ ...errors, general: signUpError.message });
      console.log(errors);
      return;
    }

    // Check if the user and session are available
    if (signUpData?.user && signUpData.session) {
      console.log("Signup successful. User ID:", signUpData.user.id);
      /*
      // Now, insert into the profile table
       const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: signUpData.user.id, name, email, role }]);
      
       if (profileError) {
        console.error("Supabase profile insertion error:", profileError.message);
        setErrors({ ...errors, general: profileError.message });
        return;
       }
      
      console.log("Profile created successfully!");
      */
  navigate('/app');
  setIsSubmitting(false);
    } else if (signUpData.user && !signUpData.session) {
      // This is the case where email confirmation is required
      console.log("Signup initiated. Please check your email for a confirmation link.");
  navigate('/check-email');
  setIsSubmitting(false);
    } else {
      // Fallback (shouldn't normally happen)
      setErrors({ ...errors, general: "This email is already registered. Please log in instead." });
      console.log(errors);
      setIsSubmitting(false);
    }

  } catch (error) {
    console.error("An unexpected error occurred:", error);
  setErrors({ ...errors, general: "An unexpected error occurred. Please try again." });
    console.log(errors);
  setIsSubmitting(false);
    }
};
  };

  return (
    <section className="bg-muted min-h-screen">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <a href={logo.url}>
            <img src={logo.src} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </a>
          <Card className="w-[420px]">
            <CardHeader className="text-center">
              {heading && <CardTitle className="text-xl">{heading}</CardTitle>}
              <CardDescription>Create an account to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && <p className="text-red-600 text-sm" role="alert">{errors.general}</p>}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting} />
                  {errors.name && <p className="text-red-600 text-xs">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSubmitting} />
                  {errors.email && <p className="text-red-600 text-xs">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSubmitting} />
                  {errors.password && <p className="text-red-600 text-xs">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Select roles</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map(role => {
                      const isSelected = roles.includes(role);
                      return (
                        <button
                          type="button"
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={`h-10 w-full rounded-md border px-3 text-sm text-left transition
                            ${isSelected 
                              ? "bg-primary text-white border-primary shadow-sm" 
                              : "bg-background text-muted-foreground hover:border-primary/50"}`}
                          disabled={isSubmitting}
                        >
                          {isSelected ? <span className="inline-flex items-center gap-2"><CheckCircle2 /> {role}</span> : role}
                        </button>
                      );
                    })}
                  </div>
                  {roles.length > 0 && (
                    <div className="text-xs text-muted-foreground">Selected: {roles.join(", ")}</div>
                  )}
                  {errors.roles && <p className="text-red-600 text-xs">{errors.roles}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="animate-spin" /> Creating account...</>) : buttonText}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{signupText}</p>
            <a href={loginUrl} className="text-primary font-medium hover:underline">Login</a>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup };