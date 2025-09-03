import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Mail, Lock, User, Building, Chrome, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useToast } from '../components/ui/use-toast';
import { Progress } from '../components/ui/progress';

// Password strength calculation
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[a-z]/.test(password)) strength += 12.5;
  if (/[A-Z]/.test(password)) strength += 12.5;
  if (/[0-9]/.test(password)) strength += 12.5;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
  return Math.min(strength, 100);
}

// Form validation schema
const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  organizationName: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface InviteData {
  organisationId: string;
  organisationName: string;
  email: string;
  role: 'admin' | 'user';
}

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  // Get invite token from URL
  const inviteToken = searchParams.get('invite');

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError: setFormError
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      organizationName: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    }
  });

  const password = watch('password');
  const passwordStrength = password ? calculatePasswordStrength(password) : 0;
  const acceptTerms = watch('acceptTerms');

  // Check invitation token if present
  useEffect(() => {
    if (inviteToken) {
      checkInvitation(inviteToken);
    }
  }, [inviteToken]);

  const checkInvitation = async (token: string) => {
    setCheckingInvite(true);
    try {
      const { data, error } = await supabase
        .from('organisation_invites')
        .select(`
          *,
          organisation:organisations(*)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        toast({
          variant: 'destructive',
          title: 'Invalid invitation',
          description: 'This invitation link is invalid or has expired.'
        });
        return;
      }

      // Check if invitation is expired
      if (new Date(data.expires_at) < new Date()) {
        toast({
          variant: 'destructive',
          title: 'Invitation expired',
          description: 'This invitation has expired. Please request a new one.'
        });
        return;
      }

      // Check if already accepted
      if (data.accepted_at) {
        toast({
          variant: 'destructive',
          title: 'Invitation already used',
          description: 'This invitation has already been accepted.'
        });
        return;
      }

      // Set invite data
      setInviteData({
        organisationId: data.organisation_id,
        organisationName: data.organisation?.name || '',
        email: data.email,
        role: data.role
      });

      // Pre-fill email
      setValue('email', data.email);
      
      toast({
        title: 'Invitation found!',
        description: `You've been invited to join ${data.organisation?.name}`
      });
    } catch (err) {
      console.error('Error checking invitation:', err);
    } finally {
      setCheckingInvite(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // If we have an invite, don't need organization name
      if (!inviteData && !data.organizationName) {
        setFormError('organizationName', {
          message: 'Organization name is required'
        });
        setIsLoading(false);
        return;
      }

      // Create account
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            // Pass invitation token if present
            invitation_token: inviteToken || undefined
          },
          emailRedirectTo: inviteToken 
            ? `${window.location.origin}/auth/callback?invite=${inviteToken}`
            : `${window.location.origin}/auth/callback`
        }
      });

      if (signupError) throw signupError;

      // If we have an invite, store it in localStorage for the callback to process
      if (inviteToken) {
        localStorage.setItem('pendingInvite', inviteToken);
      }

      // Store organization name for new orgs (non-invited users)
      if (!inviteData && data.organizationName) {
        localStorage.setItem('pendingOrgName', data.organizationName);
      }
      
      toast({
        title: 'Account created!',
        description: inviteData 
          ? `Please check your email to verify your account and join ${inviteData.organisationName}.`
          : 'Please check your email to verify your account.'
      });

      // Navigate to login page
      navigate('/login');
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        setError('This email is already registered. Please login instead.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth signup
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Pass invite token in redirect URL if present
      const redirectTo = inviteToken 
        ? `${window.location.origin}/auth/callback?invite=${inviteToken}`
        : `${window.location.origin}/auth/callback`;

      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google.');
      setIsLoading(false);
    }
  };

  // Get password strength label
  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 33) return { label: 'Weak', color: 'bg-red-500' };
    if (passwordStrength < 66) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Strong', color: 'bg-green-500' };
  };

  const strengthInfo = password ? getPasswordStrengthLabel() : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Menu Extractor
          </h1>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {inviteData 
              ? `Joining ${inviteData.organisationName} as ${inviteData.role}`
              : 'Start extracting menus in minutes'
            }
          </p>
        </div>

        {/* Signup Form Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              {inviteData
                ? 'Complete your account setup to accept the invitation'
                : 'Create a new account and organization'
              }
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

              {/* Invitation Alert */}
              {inviteData && (
                <Alert>
                  <AlertTitle>Invitation Active</AlertTitle>
                  <AlertDescription>
                    You'll be added to {inviteData.organisationName} after signup
                  </AlertDescription>
                </Alert>
              )}

              {/* Full Name Field */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('fullName')}
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10"
                    disabled={isLoading || checkingInvite}
                    autoComplete="name"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-red-600">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('email')}
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-10"
                    disabled={isLoading || checkingInvite || !!inviteData?.email}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Organization Name Field (only if not invited) */}
              {!inviteData && (
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      {...register('organizationName')}
                      id="organizationName"
                      type="text"
                      placeholder="Acme Corp"
                      className="pl-10"
                      disabled={isLoading || checkingInvite}
                    />
                  </div>
                  {errors.organizationName && (
                    <p className="text-sm text-red-600">{errors.organizationName.message}</p>
                  )}
                </div>
              )}

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('password')}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    disabled={isLoading || checkingInvite}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
                
                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Password strength</span>
                      <span className="font-medium">{strengthInfo?.label}</span>
                    </div>
                    <Progress value={passwordStrength} className="h-1" />
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('confirmPassword')}
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    disabled={isLoading || checkingInvite}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => 
                    setValue('acceptTerms', checked as boolean)
                  }
                  disabled={isLoading || checkingInvite}
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="acceptTerms" 
                    className="text-sm font-normal cursor-pointer"
                  >
                    I agree to the{' '}
                    <Link to="/terms" className="text-blue-600 hover:text-blue-500">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
                      Privacy Policy
                    </Link>
                  </Label>
                  {errors.acceptTerms && (
                    <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
                  )}
                </div>
              </div>

              {/* Signup Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || checkingInvite}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              {/* Google OAuth Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignup}
                disabled={isLoading || checkingInvite}
              >
                <Chrome className="mr-2 h-4 w-4" />
                Sign up with Google
              </Button>
            </CardContent>
          </form>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}