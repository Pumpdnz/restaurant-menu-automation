import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

// Form validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email')
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  // Start cooldown timer
  const startCooldown = () => {
    setCooldownSeconds(60); // 1 minute cooldown
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle form submission
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(data.email);
      setEmailSent(true);
      startCooldown();
    } catch (err: any) {
      // Don't reveal if email exists or not for security
      if (err.message?.includes('rate limit')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        // Always show success to prevent email enumeration
        setEmailSent(true);
        startCooldown();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend
  const handleResend = async () => {
    const email = getValues('email');
    if (!email || cooldownSeconds > 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(email);
      startCooldown();
    } catch (err: any) {
      setError('Failed to resend email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Menu Extractor
          </h1>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {emailSent 
              ? "Check your email for the reset link"
              : "We'll send you a link to reset your password"
            }
          </p>
        </div>

        {/* Form Card */}
        <Card className="mt-8">
          {!emailSent ? (
            <>
              <CardHeader>
                <CardTitle>Forgot Password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a password reset link
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  {/* Error Alert */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        {...register('email')}
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        className="pl-10"
                        disabled={isLoading}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <CardTitle className="text-center">Check your email</CardTitle>
                <CardDescription className="text-center">
                  We've sent a password reset link to{' '}
                  <span className="font-medium">{getValues('email')}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    The reset link will expire in 24 hours. If you don't see the email, 
                    check your spam folder.
                  </AlertDescription>
                </Alert>

                {/* Resend Button */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Didn't receive the email?
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={isLoading || cooldownSeconds > 0}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend in ${cooldownSeconds}s`
                    ) : (
                      'Resend Email'
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-center">
            <Link
              to="/login"
              className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}