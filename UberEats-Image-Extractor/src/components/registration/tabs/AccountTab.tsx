import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../../ui/button';
import type { YoloModeFormData, RegistrationStatus } from '../YoloModeDialog';

interface AccountTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
  registrationStatus: RegistrationStatus | null;
}

export function AccountTab({ formData, updateFormData, registrationStatus }: AccountTabProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  const isAccountComplete = registrationStatus?.account?.registration_status === 'completed';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Account Details</CardTitle>
            <Badge variant={isAccountComplete ? "default" : "outline"}>
              {isAccountComplete ? "Registered" : "Not Registered"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="register-new-user"
              checked={formData.account.registerNewUser}
              onCheckedChange={(checked) =>
                updateFormData('account', 'registerNewUser', checked as boolean)
              }
              disabled={isAccountComplete}
            />
            <Label htmlFor="register-new-user" className="cursor-pointer">
              Register New User Account
            </Label>
          </div>

          {isAccountComplete && (
            <p className="text-sm text-muted-foreground">
              Account already registered. Uncheck to skip account registration step.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.account.email}
                onChange={(e) => updateFormData('account', 'email', e.target.value)}
                placeholder="restaurant@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-phone">Phone</Label>
              <Input
                id="account-phone"
                type="tel"
                value={formData.account.phone}
                onChange={(e) => updateFormData('account', 'phone', e.target.value)}
                placeholder="+64 21 123 4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.account.password}
                onChange={(e) => updateFormData('account', 'password', e.target.value)}
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
              Default format: RestaurantName789!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
