import { useEffect, useState } from 'react';
import { Plus, Search, Tag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useSequences, SequenceTemplate } from '../hooks/useSequences';
import { CreateSequenceTemplateModal } from '../components/sequences/CreateSequenceTemplateModal';
import { EditSequenceTemplateModal } from '../components/sequences/EditSequenceTemplateModal';
import { SequenceTemplateCard } from '../components/sequences/SequenceTemplateCard';

export default function SequenceTemplates() {
  const { templates, loading, fetchTemplates, deleteTemplate, duplicateTemplate, updateTemplate } = useSequences();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SequenceTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('true');

  useEffect(() => {
    fetchTemplates({
      is_active: filterActive === 'all' ? undefined : filterActive === 'true',
      search: searchTerm || undefined,
    });
  }, [fetchTemplates, filterActive, searchTerm]);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateTemplate(id, { is_active: !isActive });
  };

  const handleEdit = (template: SequenceTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sequence Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage reusable task sequence workflows
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No sequence templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first sequence template to automate task workflows
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <SequenceTemplateCard
              key={template.id}
              template={template}
              onDelete={deleteTemplate}
              onDuplicate={duplicateTemplate}
              onToggleActive={handleToggleActive}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateSequenceTemplateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Edit Modal */}
      <EditSequenceTemplateModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </div>
  );
}
