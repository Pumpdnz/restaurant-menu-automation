import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '../../ui/alert';
import type { YoloModeFormData } from '../YoloModeDialog';

interface PaymentTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
}

export function PaymentTab({ formData, updateFormData }: PaymentTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle className="text-lg">Payment Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure Stripe payment settings for the restaurant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="include-stripe-link"
              checked={formData.payment.includeStripeLink}
              onCheckedChange={(checked) =>
                updateFormData('payment', 'includeStripeLink', checked as boolean)
              }
            />
            <div className="space-y-1">
              <Label htmlFor="include-stripe-link" className="cursor-pointer">
                Include Stripe Connect Link
              </Label>
              <p className="text-xs text-muted-foreground">
                Generate a Stripe Connect onboarding link for the restaurant owner
              </p>
            </div>
          </div>

          {formData.payment.includeStripeLink && (
            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertDescription>
                A Stripe Connect link will be generated and can be shared with the restaurant owner
                to complete their payment setup. The link will be stored in the restaurant record.
              </AlertDescription>
            </Alert>
          )}

          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> The following will be configured automatically:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>Card payments enabled</li>
              <li>Cash payments disabled</li>
              <li>Stripe test mode disabled (production)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Services Configuration</CardTitle>
          <CardDescription>
            The following service settings will be applied automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Pickup service enabled</li>
            <li>Delivery service configured</li>
            <li>Table service settings applied</li>
            <li>Order notifications enabled</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
