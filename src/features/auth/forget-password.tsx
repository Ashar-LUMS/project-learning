import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/";
import { supabase } from "../../supabaseClient";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("If an account with this email exists, a reset link has been sent.");
    }
    setLoading(false);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}> 
      <Card className="w-[370px] h-[360px]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl mb-2">Trouble logging in?</CardTitle>
          <CardDescription>
           Enter your email, phone, or username and we'll send you a link to get back into your account.

          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset}>
            <div className="grid gap-6 mb-2">
              <div className="grid gap-2.5 mb-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Email"}
              </Button>
            </div>
          </form>

          {message && (
            <p className="text-sm text-center mt-4 text-red-600">{message}</p>
          )}

          <div className="text-center text-sm mt-5">
            Remembered your password?{" "}
            <a href="/login" className="underline underline-offset-4">
              Back to login
            </a>
          </div>
        </CardContent>
      </Card>
</div>


  );
} 
