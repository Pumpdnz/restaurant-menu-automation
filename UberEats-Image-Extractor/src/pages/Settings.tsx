import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InvitationService } from '../services/invitation-service';
import { UserProfile, OrganisationInvite, UserRole } from '../types/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../components/ui/use-toast';
import { Loader2, UserPlus, Mail, Shield, User, Trash2, RefreshCw, Copy, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Settings() {
  const { user, isAdmin, inviteUser, removeUser, updateUserRole } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<OrganisationInvite[]>([]);
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  // Load organization data
  useEffect(() => {
    if (user?.organisationId) {
      loadOrganizationData();
    }
  }, [user]);

  const loadOrganizationData = async () => {
    if (!user?.organisationId) return;
    
    setLoading(true);
    try {
      // Load members
      const membersData = await InvitationService.getOrganizationMembers(user.organisationId);
      setMembers(membersData);
      
      // Load pending invitations (only for admins)
      if (isAdmin()) {
        const invitesData = await InvitationService.getPendingInvitations(user.organisationId);
        setPendingInvitations(invitesData);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading organization data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteUser) return;
    
    setInviteLoading(true);
    try {
      const url = await inviteUser(inviteEmail, inviteRole);
      setInviteUrl(url);
      
      toast({
        title: 'Invitation sent!',
        description: `An invitation email has been sent to ${inviteEmail}. They have 7 days to accept.`
      });
      
      // Reload invitations
      await loadOrganizationData();
    } catch (error: any) {
      toast({
        title: 'Failed to send invitation',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!removeUser || !confirm(`Are you sure you want to remove ${userName} from the organization?`)) return;
    
    try {
      await removeUser(userId);
      toast({
        title: 'User removed',
        description: `${userName} has been removed from the organization`
      });
      await loadOrganizationData();
    } catch (error: any) {
      toast({
        title: 'Failed to remove user',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user', userName: string) => {
    if (!updateUserRole) return;
    
    try {
      await updateUserRole(userId, newRole);
      toast({
        title: 'Role updated',
        description: `${userName} is now ${newRole === 'admin' ? 'an admin' : 'a user'}`
      });
      await loadOrganizationData();
    } catch (error: any) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await InvitationService.cancelInvitation(invitationId);
      toast({
        title: 'Invitation cancelled'
      });
      await loadOrganizationData();
    } catch (error: any) {
      toast({
        title: 'Failed to cancel invitation',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      await InvitationService.resendInvitation(invitationId);
      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${email}`
      });
      await loadOrganizationData();
    } catch (error: any) {
      toast({
        title: 'Failed to resend invitation',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Copied!',
      description: 'Invitation link copied to clipboard'
    });
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return <Shield className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your organization members and settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations" disabled={!isAdmin()}>
            Invitations
            {pendingInvitations.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {pendingInvitations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    {members.length} member{members.length !== 1 ? 's' : ''} in your organization
                  </CardDescription>
                </div>
                {isAdmin() && (
                  <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join your organization
                        </DialogDescription>
                      </DialogHeader>
                      
                      {!inviteUrl ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="colleague@company.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={inviteRole} onValueChange={(value: 'admin' | 'user') => setInviteRole(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                              Admins can invite and manage other members
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                              Invitation email sent to {inviteEmail}!
                            </AlertDescription>
                          </Alert>
                          
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              The invitation has been sent via email. You can also share this link directly:
                            </p>
                            
                            <div className="flex items-center space-x-2">
                              <Input
                                value={inviteUrl}
                                readOnly
                                className="font-mono text-sm"
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={copyInviteUrl}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-500">
                            This invitation expires in 7 days
                          </p>
                        </div>
                      )}
                      
                      <DialogFooter>
                        {!inviteUrl ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setInviteModalOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleInviteUser}
                              disabled={!inviteEmail || inviteLoading}
                            >
                              {inviteLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Send Invitation
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => {
                              setInviteModalOpen(false);
                              setInviteUrl('');
                              setInviteEmail('');
                              setInviteRole('user');
                            }}
                          >
                            Done
                          </Button>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <span className="text-sm font-medium text-gray-600">
                            {member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{member.name || 'Unknown'}</p>
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {getRoleIcon(member.role)}
                              <span className="ml-1">{member.role}</span>
                            </Badge>
                            {member.id === user?.id && (
                              <Badge variant="outline">You</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      
                      {isAdmin() && member.id !== user?.id && member.role !== 'super_admin' && (
                        <div className="flex items-center space-x-2">
                          <Select
                            value={member.role}
                            onValueChange={(value: 'admin' | 'user') => 
                              handleUpdateRole(member.id, value, member.name || member.email)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveUser(member.id, member.name || member.email)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Manage pending invitations to your organization
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : pendingInvitations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pending invitations
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{invitation.email}</p>
                          <Badge variant="secondary">
                            {invitation.role}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                          </span>
                          <span>
                            Invited {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Resend
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                View and manage your organization information
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {user?.organisation?.name || 'Default Organization'}
                </p>
              </div>
              
              <div>
                <Label>Organization ID</Label>
                <p className="text-sm text-gray-600 mt-1 font-mono">
                  {user?.organisationId}
                </p>
              </div>
              
              <div>
                <Label>Your Role</Label>
                <div className="mt-1">
                  <Badge variant={getRoleBadgeVariant(user?.role || 'user')}>
                    {getRoleIcon(user?.role || 'user')}
                    <span className="ml-1">{user?.role}</span>
                  </Badge>
                </div>
              </div>
              
              {user?.organisation?.created_at && (
                <div>
                  <Label>Created</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(user.organisation.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}