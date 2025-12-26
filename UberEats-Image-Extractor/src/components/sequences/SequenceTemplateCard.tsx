import { useState } from 'react';
import { MoreVertical, Copy, Trash2, Eye, EyeOff, ChevronDown, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { SequenceTemplate } from '../../hooks/useSequences';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface SequenceTemplateCardProps {
  template: SequenceTemplate;
  onDelete: (id: string) => Promise<boolean>;
  onDuplicate: (id: string, newName?: string) => Promise<any>;
  onToggleActive: (id: string, isActive: boolean) => Promise<any>;
  onEdit: (template: SequenceTemplate) => void;
}

export function SequenceTemplateCard({
  template,
  onDelete,
  onDuplicate,
  onToggleActive,
  onEdit,
}: SequenceTemplateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const success = await onDelete(template.id);
    setDeleting(false);
    if (success) {
      setDeleteDialogOpen(false);
    }
  };

  const handleDuplicate = async () => {
    await onDuplicate(template.id);
  };

  const handleToggleActive = async () => {
    await onToggleActive(template.id, template.is_active);
  };

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <Badge variant={template.is_active ? 'default' : 'secondary'}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{template.sequence_steps.length} steps</span>
                  <span>•</span>
                  <span>Used {template.usage_count} times</span>
                  {template.tags && template.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex gap-1">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        !expanded && "-rotate-90"
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(template)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleActive}>
                    {template.is_active ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <CardContent>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Sequence Steps</h4>
              <div className="space-y-2">
                {template.sequence_steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{step.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {step.type}
                        </Badge>
                        {step.priority !== 'medium' && (
                          <Badge
                            variant={step.priority === 'high' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {step.priority}
                          </Badge>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.delay_value === 0
                          ? 'Immediate'
                          : `After ${step.delay_value} ${step.delay_unit}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{template.name}"? This action cannot be undone.
              {template.usage_count > 0 && (
                <span className="block mt-2 text-orange-600">
                  This template has been used {template.usage_count} times. Active sequences will not be affected.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
