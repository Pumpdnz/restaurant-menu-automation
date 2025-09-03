// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationRequest {
  email: string
  inviterName: string
  organizationName: string
  role: string
  inviteUrl: string
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the request body
    const { email, inviterName, organizationName, role, inviteUrl }: InvitationRequest = await req.json()

    // Validate required fields
    if (!email || !inviteUrl || !organizationName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invitation to ${organizationName}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              width: 60px;
              height: 60px;
              margin-bottom: 20px;
              display: inline-block;
            }
            h1 {
              color: #1f2937;
              font-size: 24px;
              margin: 0 0 10px 0;
            }
            .invite-box {
              background-color: #f3f4f6;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .role-badge {
              display: inline-block;
              padding: 4px 12px;
              background-color: #e5e7eb;
              border-radius: 4px;
              font-size: 14px;
              font-weight: 500;
              color: #4b5563;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <td>
                    <img src="https://qgabsyggzlkcstjzugdh.supabase.co/storage/v1/object/public/assets/logos/pumpd-logo-email.png" alt="Pump'd Logo" width="80" height="80" style="display: block; border: 0;" />
                  </td>
                </tr>
              </table>
              <h1>You're invited to join ${organizationName}</h1>
            </div>
            
            <p>Hi there,</p>
            
            <p>${inviterName ? `${inviterName} has` : 'You have been'} invited you to join <strong>${organizationName}</strong> on Menu Extractor.</p>
            
            <div class="invite-box">
              <p><strong>Organization:</strong> ${organizationName}</p>
              <p><strong>Your role:</strong> <span class="role-badge">${role}</span></p>
            </div>
            
            <p>Click the button below to accept this invitation:</p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Or copy and paste this link in your browser:<br>
              <code style="word-break: break-all;">${inviteUrl}</code>
            </p>
            
            <div class="footer">
              <p>This invitation will expire in 7 days.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using Resend (Supabase's email provider)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (RESEND_API_KEY && RESEND_API_KEY !== 'your_resend_api_key_here') {
      // Use Resend API if configured
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Menu Extractor <noreply@pumpd.co.nz>',
          to: [email],
          subject: `Invitation to join ${organizationName}`,
          html: emailHtml,
        }),
      })

      if (!res.ok) {
        const errorData = await res.text()
        console.error('Resend API error:', errorData)
        throw new Error(`Failed to send email: ${res.statusText}`)
      }
      
      console.log(`Invitation email sent successfully to ${email}`)
    } else {
      // Development mode - log the invitation details
      console.log(`Would send invitation email to: ${email}`)
      console.log(`Invitation URL: ${inviteUrl}`)
      
      // Return success with instructions for setting up email
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invitation created (email not sent - Resend not configured)',
          inviteUrl: inviteUrl,
          instructions: 'To enable email sending, set RESEND_API_KEY in Supabase Edge Function secrets'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Invitation email sent' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error sending invitation:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invitation' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})