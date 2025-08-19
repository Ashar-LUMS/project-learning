import { useState } from 'react';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.ts';

// 1. Define the Zod schema for the form data
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.string().min(1, { message: "Role is required." })
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
  const [role, setRole] = useState(''); 

  // 3. Use state to manage validation errors
  const [errors, setErrors] = useState({ name: '', email: '', password: '', role: '', general: '' });

  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // 4. Create a function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ name: '', email: '', password: '', role: '', general: '' }); // Clear previous errors

    // **Corrected:** Pass 'role' to safeParse to validate all fields
    const result = signupSchema.safeParse({ name, email, password, role });

    if (!result.success) {
      // **Added:** Detailed logging for Zod validation errors
      console.error("Form validation failed:", result.error); 

      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0] || '',
        email: fieldErrors.email?.[0] || '',
        password: fieldErrors.password?.[0] || '',
        role: fieldErrors.role?.[0] || '',
        general: '', 
      });
      return; // Stop the function if validation fails
    }

  if (result.success) {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    });

    if (signUpError) {
      console.error("Supabase sign-up error:", signUpError.message);
      setErrors({ ...errors, general: signUpError.message });
      return;
    }

    // Check if the user and session are available
    if (signUpData.user && signUpData.session) {
      console.log("Signup successful. User ID:", signUpData.user.id);
      
      // Now, insert the profile data
       const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: signUpData.user.id, name, email, role }]);
      
       if (profileError) {
        console.error("Supabase profile insertion error:", profileError.message);
        setErrors({ ...errors, general: profileError.message });
        return;
       }

      console.log("Profile created successfully!");
      navigate('/app');
    } else {
      // This is the case where email confirmation is required
      console.log("Signup initiated. Please check your email for a confirmation link.");
      navigate('/check-email');
    }

  } catch (error) {
    console.error("An unexpected error occurred:", error);
    setErrors({ ...errors, general: "An unexpected error occurred. Please try again." });
    }
};
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
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-y-4">
              {/* Added a place to display general errors */}
              {errors.general && <p className="text-red-500 text-sm">{errors.general}</p>}
              
              <Input
                type="text"
                placeholder="Name"
                className="text-md"
                //required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {/* Added a place to display name-specific errors */}
              {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}

              <Input
                type="email"
                placeholder="Email"
                className="text-md"
                //required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {/* Added a place to display email-specific errors */}
              {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}

              <Input
                type="password"
                placeholder="Password"
                className="text-md"
                //required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* Added a place to display password-specific errors */}
              {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}

              <Input
                type="text"
                placeholder="Role"
                className="text-md"
                //required
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              {/* Added a place to display role-specific errors */}
              {errors.role && <p className="text-red-500 text-sm">{errors.role}</p>}

              <Button type="submit" className="w-full">
                {buttonText}
              </Button>
            </form>
          </div>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{signupText}</p>
            <a
              href={loginUrl}
              className="text-primary font-medium hover:underline"
            >
              Login
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup };