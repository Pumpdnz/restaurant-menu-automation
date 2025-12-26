import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { UserPlus, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../ui/button';
import { useAuth } from '../../../context/AuthContext';
import type { YoloModeFormData } from '../YoloModeDialog';

interface OnboardingTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
}

export function OnboardingTab({ formData, updateFormData }: OnboardingTabProps) {
  const { isFeatureEnabled } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);

  const showOnboardingSync = isFeatureEnabled('registration.onboardingSync');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            <CardTitle className="text-lg">Onboarding User</CardTitle>
          </div>
          <CardDescription>
            Create a user account in the onboarding system for the restaurant owner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-onboarding-user"
              checked={formData.onboarding.createOnboardingUser}
              onCheckedChange={(checked) =>
                updateFormData('onboarding', 'createOnboardingUser', checked as boolean)
              }
            />
            <Label htmlFor="create-onboarding-user" className="cursor-pointer">
              Create Onboarding User Account
            </Label>
          </div>

          {formData.onboarding.createOnboardingUser && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onboarding-name">User Name</Label>
                  <Input
                    id="onboarding-name"
                    value={formData.onboarding.userName}
                    onChange={(e) => updateFormData('onboarding', 'userName', e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboarding-email">User Email</Label>
                  <Input
                    id="onboarding-email"
                    type="email"
                    value={formData.onboarding.userEmail}
                    onChange={(e) => updateFormData('onboarding', 'userEmail', e.target.value)}
                    placeholder="owner@restaurant.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="onboarding-password">Password (optional)</Label>
                <div className="relative">
                  <Input
                    id="onboarding-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.onboarding.userPassword}
                    onChange={(e) => updateFormData('onboarding', 'userPassword', e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If left blank, a secure password will be auto-generated
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showOnboardingSync && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              <CardTitle className="text-lg">Onboarding Sync</CardTitle>
            </div>
            <CardDescription>
              Sync restaurant data to the onboarding record
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="sync-onboarding-record"
                checked={formData.onboarding.syncOnboardingRecord}
                onCheckedChange={(checked) =>
                  updateFormData('onboarding', 'syncOnboardingRecord', checked as boolean)
                }
                disabled={!formData.onboarding.createOnboardingUser}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="sync-onboarding-record"
                  className={`cursor-pointer ${!formData.onboarding.createOnboardingUser ? 'text-muted-foreground' : ''}`}
                >
                  Sync Onboarding Record After User Creation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Update the onboarding database with restaurant registration details
                </p>
              </div>
            </div>

            {!formData.onboarding.createOnboardingUser && (
              <p className="text-xs text-amber-600">
                Enable "Create Onboarding User Account" to use this feature
              </p>
            )}

            {formData.onboarding.syncOnboardingRecord && formData.onboarding.createOnboardingUser && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  The following data will be synced:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Restaurant registration status</li>
                  <li>Pumpd subdomain and dashboard URL</li>
                  <li>Stripe Connect URL (if generated)</li>
                  <li>Contact information</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
