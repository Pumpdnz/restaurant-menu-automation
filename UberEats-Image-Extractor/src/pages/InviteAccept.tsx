import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvitationService } from '../services/invitation-service';
import { OrganisationInvite } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, XCircle, Building, Mail, Shield, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [invitation, setInvitation] = useState<OrganisationInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token && !authLoading) {
      validateInvitation();
    }
  }, [token, authLoading]);

  const validateInvitation = async () => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const inviteData = await InvitationService.validateInvitation(token);
      
      if (!inviteData) {
        setError('This invitation is invalid or has expired');
        setLoading(false);
        return;
      }

      setInvitation(inviteData);
    } catch (err: any) {
      console.error('Validation error:', err);
      setError('Failed to validate invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation || !token) return;

    setAccepting(true);
    setError(null);

    try {
      if (user) {
        // Existing user - just accept the invitation
        await InvitationService.acceptInvitation(token, user.id);
        setSuccess(true);
        
        // Refresh the page to reload user context with new org
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // New user - redirect to signup with invitation token
        navigate(`/signup?invite=${token}`);
      }
    } catch (err: any) {
      console.error('Accept error:', err);
      setError(err.message || 'Failed to accept invitation');
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = () => {
    navigate('/');
  };

  // Show loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-center">Invitation Accepted!</CardTitle>
            <CardDescription className="text-center">
              You've successfully joined {invitation?.organisation?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-gray-600">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invitation details
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="text-center mb-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Building className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join an organization
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {invitation && (
            <>
              <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Organization</p>
                  <p className="font-semibold text-lg">
                    {invitation.organisation?.name || 'Unknown Organization'}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Your Email</p>
                    <p className="font-medium flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />
                      {invitation.email}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                      {invitation.role === 'admin' ? (
                        <Shield className="mr-1 h-3 w-3" />
                      ) : (
                        <User className="mr-1 h-3 w-3" />
                      )}
                      {invitation.role}
                    </Badge>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {user ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">
                    Accept this invitation as <strong>{user.email}</strong>?
                  </p>
                  {user.organisationId !== '00000000-0000-0000-0000-000000000000' && (
                    <Alert>
                      <AlertDescription>
                        You'll leave your current organization and join {invitation.organisation?.name}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 text-center">
                  You'll need to create an account or sign in to accept this invitation
                </p>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDeclineInvitation}
            disabled={accepting}
            className="flex-1"
          >
            Decline
          </Button>
          <Button
            onClick={handleAcceptInvitation}
            disabled={accepting || !invitation}
            className="flex-1"
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : user ? (
              'Accept Invitation'
            ) : (
              'Sign Up & Accept'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}