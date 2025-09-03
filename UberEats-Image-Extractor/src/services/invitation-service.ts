import { supabase } from '../lib/supabase';
import { generateSecureToken, generateExpiryDate, isExpired } from '../utils/crypto';
import { OrganisationInvite, UserRole } from '../types/auth';

/**
 * Service for managing organization invitations
 */
export class InvitationService {
  /**
   * Creates a new invitation for a user to join an organization
   * @param email - Email address to invite
   * @param role - Role to assign (admin or user)
   * @param organisationId - Organization ID
   * @param invitedBy - User ID of the inviter
   * @returns The invitation token
   */
  static async createInvitation(
    email: string,
    role: Exclude<UserRole, 'super_admin'>,
    organisationId: string,
    invitedBy: string
  ): Promise<string> {
    try {
      // Check if there's already a pending invitation for this email
      const { data: existing } = await supabase
        .from('organisation_invites')
        .select('*')
        .eq('email', email)
        .eq('organisation_id', organisationId)
        .is('accepted_at', null);

      if (existing && existing.length > 0) {
        // Check if any existing invitations are still valid
        const validInvite = existing.find(inv => !isExpired(inv.expires_at));
        if (validInvite) {
          throw new Error('An invitation for this email is already pending');
        }
      }

      // Generate secure token and expiry
      const token = generateSecureToken();
      const expiresAt = generateExpiryDate(7); // 7 days

      // Create the invitation record
      const { data, error } = await supabase
        .from('organisation_invites')
        .insert({
          email,
          role,
          organisation_id: organisationId,
          invited_by: invitedBy,
          token,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      // Generate the invitation URL
      const inviteUrl = this.generateInvitationUrl(token);
      
      // Get inviter details for the email
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', invitedBy)
        .single();
      
      // Get organization details
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', organisationId)
        .single();
      
      // Send invitation email via Edge Function
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-invitation', {
          body: {
            email,
            inviterName: inviterProfile?.name || 'A team member',
            organizationName: org?.name || 'the organization',
            role: role.charAt(0).toUpperCase() + role.slice(1),
            inviteUrl
          }
        });

        if (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Don't throw - the invitation record is created, just email failed
          // In development, this is expected if Edge Function isn't deployed
        }
      } catch (emailError) {
        console.error('Edge function error:', emailError);
        // Continue - invitation is created, just email didn't send
      }
      
      return token;
    } catch (error: any) {
      console.error('Create invitation error:', error);
      throw new Error(error.message || 'Failed to create invitation');
    }
  }

  /**
   * Validates an invitation token
   * @param token - The invitation token to validate
   * @returns The invitation data if valid, null otherwise
   */
  static async validateInvitation(token: string): Promise<OrganisationInvite | null> {
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
        console.log('Invitation not found');
        return null;
      }

      // Check if already accepted
      if (data.accepted_at) {
        console.log('Invitation already accepted');
        return null;
      }

      // Check if expired
      if (isExpired(data.expires_at)) {
        console.log('Invitation expired');
        return null;
      }

      return data as any;
    } catch (error: any) {
      console.error('Validate invitation error:', error);
      return null;
    }
  }

  /**
   * Accepts an invitation and adds the user to the organization
   * @param token - The invitation token
   * @param userId - The user accepting the invitation
   * @returns The organization data
   */
  static async acceptInvitation(token: string, userId: string) {
    try {
      // Validate the invitation first
      const invitation = await this.validateInvitation(token);
      
      if (!invitation) {
        throw new Error('Invalid or expired invitation');
      }

      // Start a transaction-like operation
      // First, update the user's profile with the organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organisation_id: invitation.organisation_id,
          role: invitation.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Mark the invitation as accepted
      const { error: inviteError } = await supabase
        .from('organisation_invites')
        .update({
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (inviteError) throw inviteError;

      // Return the organization data we fetched earlier
      const { data: org } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', invitation.organisation_id)
        .single();
      
      return org;
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      throw new Error(error.message || 'Failed to accept invitation');
    }
  }

  /**
   * Gets all members of an organization
   * @param organisationId - The organization ID
   * @returns List of organization members
   */
  static async getOrganizationMembers(organisationId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      console.error('Get organization members error:', error);
      throw new Error(error.message || 'Failed to get organization members');
    }
  }

  /**
   * Gets pending invitations for an organization
   * @param organisationId - The organization ID
   * @returns List of pending invitations
   */
  static async getPendingInvitations(organisationId: string) {
    try {
      // First get the invitations
      const { data, error } = await supabase
        .from('organisation_invites')
        .select('*')
        .eq('organisation_id', organisationId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out expired invitations
      const validInvitations = (data || []).filter(
        inv => !isExpired(inv.expires_at)
      );

      // Optionally fetch inviter details separately if needed
      // For now, we'll just return the invitations without inviter details
      
      return validInvitations;
    } catch (error: any) {
      console.error('Get pending invitations error:', error);
      throw new Error(error.message || 'Failed to get pending invitations');
    }
  }

  /**
   * Cancels a pending invitation
   * @param invitationId - The invitation ID to cancel
   */
  static async cancelInvitation(invitationId: string) {
    try {
      const { error } = await supabase
        .from('organisation_invites')
        .delete()
        .eq('id', invitationId)
        .is('accepted_at', null);

      if (error) throw error;
    } catch (error: any) {
      console.error('Cancel invitation error:', error);
      throw new Error(error.message || 'Failed to cancel invitation');
    }
  }

  /**
   * Resends an invitation email
   * @param invitationId - The invitation ID to resend
   * @returns The invitation token
   */
  static async resendInvitation(invitationId: string): Promise<string> {
    try {
      // Get the invitation
      const { data: invitation, error } = await supabase
        .from('organisation_invites')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (error || !invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.accepted_at) {
        throw new Error('Invitation already accepted');
      }

      // Update expiry date to extend it
      const newExpiryDate = generateExpiryDate(7);
      
      const { error: updateError } = await supabase
        .from('organisation_invites')
        .update({
          expires_at: newExpiryDate
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // Get inviter and organization details for the email
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', invitation.invited_by)
        .single();
      
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', invitation.organisation_id)
        .single();
      
      // Generate the invitation URL
      const inviteUrl = this.generateInvitationUrl(invitation.token);
      
      // Resend invitation email via Edge Function
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-invitation', {
          body: {
            email: invitation.email,
            inviterName: inviterProfile?.name || 'A team member',
            organizationName: org?.name || 'the organization',
            role: invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1),
            inviteUrl
          }
        });

        if (emailError) {
          console.error('Failed to resend invitation email:', emailError);
        }
      } catch (emailError) {
        console.error('Edge function error:', emailError);
      }
      
      return invitation.token;
    } catch (error: any) {
      console.error('Resend invitation error:', error);
      throw new Error(error.message || 'Failed to resend invitation');
    }
  }

  /**
   * Removes a user from an organization
   * @param userId - The user ID to remove
   * @param organisationId - The organization ID
   */
  static async removeUser(userId: string, organisationId: string) {
    try {
      // Set the user's organization to the default org
      const { error } = await supabase
        .from('profiles')
        .update({
          organisation_id: '00000000-0000-0000-0000-000000000000', // Default org
          role: 'user',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .eq('organisation_id', organisationId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Remove user error:', error);
      throw new Error(error.message || 'Failed to remove user');
    }
  }

  /**
   * Updates a user's role in an organization
   * @param userId - The user ID
   * @param role - The new role
   * @param organisationId - The organization ID
   */
  static async updateUserRole(
    userId: string,
    role: Exclude<UserRole, 'super_admin'>,
    organisationId: string
  ) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .eq('organisation_id', organisationId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Update user role error:', error);
      throw new Error(error.message || 'Failed to update user role');
    }
  }

  /**
   * Generates an invitation URL
   * @param token - The invitation token
   * @returns The full invitation URL
   */
  static generateInvitationUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${token}`;
  }
}