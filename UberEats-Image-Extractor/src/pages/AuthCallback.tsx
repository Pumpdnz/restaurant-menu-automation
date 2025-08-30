import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Get the session from the URL
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session) {
        throw new Error('No session found');
      }

      setStatus('Setting up your account...');

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, organisation:organisations(*)')
        .eq('id', session.user.id)
        .single();

      // Check for invitation token
      const inviteToken = searchParams.get('invite');
      
      if (inviteToken) {
        setStatus('Processing invitation...');
        
        // Get invitation details
        const { data: invite, error: inviteError } = await supabase
          .from('organisation_invites')
          .select('*, organisation:organisations(*)')
          .eq('token', inviteToken)
          .single();

        if (invite && !invite.accepted_at) {
          // Check if invitation matches user email
          if (invite.email !== session.user.email) {
            throw new Error('This invitation is for a different email address');
          }

          // Check if invitation is expired
          if (new Date(invite.expires_at) < new Date()) {
            throw new Error('This invitation has expired');
          }

          // Accept the invitation
          if (profile) {
            // Update existing profile with organization
            await supabase
              .from('profiles')
              .update({
                organisation_id: invite.organisation_id,
                role: invite.role,
                updated_at: new Date().toISOString()
              })
              .eq('id', session.user.id);
          }

          // Mark invitation as accepted
          await supabase
            .from('organisation_invites')
            .update({ 
              accepted_at: new Date().toISOString() 
            })
            .eq('id', invite.id);

          setStatus('Invitation accepted! Redirecting...');
        }
      }

      // If no profile exists, create one
      if (profileError && profileError.code === 'PGRST116') {
        setStatus('Creating your profile...');
        
        let organisationId = '00000000-0000-0000-0000-000000000000'; // Default org
        let role = 'admin'; // First user is admin of their org

        // Check if user was invited
        if (inviteToken) {
          const { data: invite } = await supabase
            .from('organisation_invites')
            .select('*')
            .eq('token', inviteToken)
            .single();

          if (invite) {
            organisationId = invite.organisation_id;
            role = invite.role;
          }
        } else {
          // Create a new organization for this user
          const orgName = session.user.user_metadata?.name 
            ? `${session.user.user_metadata.name}'s Organization`
            : `${session.user.email?.split('@')[0]}'s Organization`;

          const { data: newOrg, error: orgError } = await supabase
            .from('organisations')
            .insert({
              name: orgName
            })
            .select()
            .single();

          if (newOrg) {
            organisationId = newOrg.id;
          }
        }

        // Create profile
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || 
                  session.user.user_metadata?.full_name || 
                  session.user.email?.split('@')[0] || 'User',
            role: role,
            organisation_id: organisationId
          });

        if (createError) {
          console.error('Profile creation error:', createError);
          throw new Error('Failed to create user profile');
        }
      }

      setStatus('Success! Redirecting to dashboard...');
      
      // Small delay for user feedback
      setTimeout(() => {
        navigate('/');
      }, 1000);

    } catch (err: any) {
      console.error('Auth callback error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
      
      // Redirect to login after error
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">
            {error ? 'Authentication Error' : 'Completing Sign In'}
          </CardTitle>
          <CardDescription className="text-center">
            {error ? 'There was a problem signing you in' : 'Please wait while we set up your account'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">{status}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}