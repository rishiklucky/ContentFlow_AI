import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Trash2,
  Copy,
  Edit3,
  Eye,
  ArrowRight,
  ExternalLink,
  Layers,
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  X,
  Save,
} from 'lucide-react';
import { projectService, transformationService } from '../services/api';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import TransformationWorkspace from '../components/transformations/TransformationWorkspace';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Active Project Detail state
  const [activeProject, setActiveProject] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Active Transformation view state
  const [selectedTransformation, setSelectedTransformation] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await projectService.list(params);
      setProjects(data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (id) => {
    try {
      setLoadingDetail(true);
      const detail = await projectService.get(id);
      setActiveProject(detail);
      setSelectedTransformation(null);
    } catch (err) {
      alert(err.message || 'Failed to open project.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('Project name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const tagsArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);
      const newProj = await projectService.create({
        name: formName.trim(),
        description: formDescription.trim() || null,
        tags: tagsArray,
      });
      setProjects((prev) => [newProj, ...prev]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProject || !formName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const tagsArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);
      const updated = await projectService.update(editingProject.id, {
        name: formName.trim(),
        description: formDescription.trim() || null,
        tags: tagsArray,
        status: formStatus,
      });

      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (activeProject?.id === updated.id) {
        setActiveProject((prev) => ({ ...prev, ...updated }));
      }
      setEditingProject(null);
      resetForm();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    try {
      const cloned = await projectService.duplicate(id);
      setProjects((prev) => [cloned, ...prev]);
    } catch (err) {
      alert(err.message || 'Failed to duplicate project.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProjectId) return;
    try {
      setIsSubmitting(true);
      await projectService.delete(deletingProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProjectId));
      if (activeProject?.id === deletingProjectId) {
        setActiveProject(null);
      }
      setDeletingProjectId(null);
    } catch (err) {
      alert(err.message || 'Failed to delete project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (proj, e) => {
    e.stopPropagation();
    setEditingProject(proj);
    setFormName(proj.name);
    setFormDescription(proj.description || '');
    setFormTags((proj.tags || []).join(', '));
    setFormStatus(proj.status || 'active');
    setErrorMessage('');
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTags('');
    setFormStatus('active');
    setErrorMessage('');
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = p.name.toLowerCase().includes(q);
    const matchDesc = p.description?.toLowerCase().includes(q);
    const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
    return matchName || matchDesc || matchTags;
  });

  // View: Active Transformation inside Project
  if (selectedTransformation) {
    return (
      <div className="container-fluid px-0">
        <div className="d-flex justify-content-between align-items-center mb-4 hairline-b pb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="telemetry-meta">// PROJECT: {activeProject?.name?.toUpperCase()}</span>
              <Badge variant="success">OPEN DOSSIER</Badge>
            </div>
            <h1 className="heading-display h3 mb-0">{selectedTransformation.title}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTransformation(null)}
          >
            ← BACK TO PROJECT
          </Button>
        </div>

        <TransformationWorkspace
          transformation={selectedTransformation}
          onTransformationUpdated={(updated) => {
            setSelectedTransformation(updated);
            if (activeProject) {
              const nextTrans = (activeProject.transformations || []).map((t) =>
                t.id === updated.id ? { ...t, ...updated } : t
              );
              setActiveProject({ ...activeProject, transformations: nextTrans });
            }
          }}
          onBackToConfig={() => setSelectedTransformation(null)}
        />
      </div>
    );
  }

  // View: Single Project Detail View
  if (activeProject) {
    const transformations = activeProject.transformations || [];
    return (
      <div className="container-fluid px-0">
        {/* Project Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <button
                type="button"
                className="btn btn-link p-0 font-mono text-xs text-muted text-decoration-none hover-dark"
                onClick={() => setActiveProject(null)}
              >
                ← ALL PROJECTS
              </button>
              <span className="text-muted">•</span>
              <Badge variant={activeProject.status === 'active' ? 'success' : 'default'}>
                {activeProject.status.toUpperCase()}
              </Badge>
              <span className="font-mono text-muted text-xs">
                {new Date(activeProject.created_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="heading-display h2 mb-1 text-break">{activeProject.name}</h1>
            {activeProject.description && (
              <p className="font-sans text-muted text-sm mb-0">{activeProject.description}</p>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={Edit3}
              onClick={(e) => openEditModal(activeProject, e)}
            >
              EDIT PROJECT
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate('/transform/new')}
            >
              NEW TRANSFORMATION
            </Button>
          </div>
        </div>

        {/* Tags */}
        {activeProject.tags && activeProject.tags.length > 0 && (
          <div className="d-flex align-items-center gap-1 flex-wrap mb-4 font-mono text-xs">
            <Tag size={13} className="text-muted me-1" />
            {activeProject.tags.map((tag, idx) => (
              <span key={idx} className="badge bg-light text-dark border font-mono">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Project's Transformations List */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="heading-display h6 mb-0">
              Transformations in this Project ({transformations.length})
            </h3>
          </div>

          {transformations.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Transformations in this Project"
              description="Transformations created in this workspace or assigned here will appear in this ledger."
              actionLabel="START TRANSFORMATION"
              onAction={() => navigate('/transform/new')}
            />
          ) : (
            <div className="row g-3">
              {transformations.map((t) => (
                <div key={t.id} className="col-12 col-lg-6">
                  <div
                    className="p-3 border hairline-border bg-white shadow-sm h-100 d-flex flex-column justify-content-between cursor-pointer transition-colors hover-dark"
                    style={{ cursor: 'pointer' }}
                    onClick={async () => {
                      const full = await transformationService.get(t.id);
                      setSelectedTransformation(full);
                    }}
                  >
                    <div>
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <Badge variant={t.status === 'completed' ? 'success' : 'vermilion'}>
                          {t.status.toUpperCase()}
                        </Badge>
                        <span className="font-mono text-muted text-xs">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="heading-display h6 mb-1 text-truncate" title={t.title}>
                        {t.title}
                      </h4>

                      {t.source_title && (
                        <div className="font-mono text-muted text-xs text-truncate mb-2">
                          SOURCE: {t.source_title}
                        </div>
                      )}

                      <div className="d-flex gap-1 flex-wrap mb-2">
                        {(t.selected_formats || []).map((fmt) => (
                          <span key={fmt} className="badge bg-light text-muted border font-mono" style={{ fontSize: '9px' }}>
                            {fmt.replace('_', ' ').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 hairline-t d-flex justify-content-between align-items-center font-mono text-xs">
                      <span className="text-muted">{t.output_count} OUTPUT FORMATS</span>
                      <span className="text-primary fw-bold">OPEN DOSSIER →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Main Projects Workspace List
  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// WORKSPACE REPOSITORY</span>
            <Badge variant="default">{projects.length} PROJECTS</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Project Portfolios</h1>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          CREATE NEW PROJECT
        </Button>
      </div>

      {/* Search, Filter, and Ledger Controls */}
      <div className="p-3 border hairline-border bg-white mb-4 d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3 shadow-sm">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '440px' }}>
          <div className="input-group">
            <span className="input-group-text bg-light rounded-0 border-end-0">
              <Search size={15} className="text-muted" />
            </span>
            <input
              type="text"
              className="cf-input border-start-0"
              placeholder="Search projects by name, description, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 font-mono text-xs">
          <span className="text-muted">STATUS:</span>
          {['all', 'active', 'archived'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm rounded-0 font-mono text-xs text-nowrap px-2 py-1 ${
                statusFilter === st
                  ? 'btn-dark text-white fw-bold'
                  : 'btn-outline-secondary border-0 text-muted'
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="text-center py-5 font-mono text-muted">
          <div className="spinner-border text-dark mb-2" role="status" />
          <div className="text-xs">LOADING PROJECT WORKSPACES FROM NEON DB...</div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={searchQuery ? 'No Matching Projects' : 'No Projects Created Yet'}
          description={
            searchQuery
              ? 'Try adjusting your search query or status filter.'
              : 'Create project workspaces to organize related sources, communication dossiers, and multi-format outputs.'
          }
          actionLabel="CREATE YOUR FIRST PROJECT"
          actionIcon={Plus}
          onAction={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        />
      ) : (
        <div className="row g-3">
          {filteredProjects.map((project) => (
            <div key={project.id} className="col-12 col-md-6 col-xl-4">
              <div
                className="p-3 border hairline-border bg-white shadow-sm h-100 d-flex flex-column justify-content-between transition-colors hover-dark"
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenProject(project.id)}
              >
                <div>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <Badge variant={project.status === 'active' ? 'success' : 'default'}>
                      {project.status.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-muted text-xs">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="heading-display h6 mb-1 text-truncate" title={project.name}>
                    {project.name}
                  </h3>

                  {project.description && (
                    <p className="font-sans text-muted text-xs mb-2 line-clamp-2" style={{ lineHeight: 1.5 }}>
                      {project.description}
                    </p>
                  )}

                  {project.tags && project.tags.length > 0 && (
                    <div className="d-flex gap-1 flex-wrap mb-2">
                      {project.tags.map((t, idx) => (
                        <span key={idx} className="badge bg-light text-muted border font-mono" style={{ fontSize: '9px' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 hairline-t">
                  <div className="d-flex justify-content-between align-items-center font-mono text-xs text-muted mb-2">
                    <span>{project.transformation_count} TRANSFORMATIONS</span>
                    <span>UPDATED: {new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-2">
                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(project.id);
                      }}
                    >
                      <FolderOpen size={12} className="me-1" /> OPEN
                    </button>

                    <div className="d-flex gap-1">
                      <button
                        type="button"
                        className="cf-btn cf-btn-sm cf-btn-outline"
                        title="Rename or Edit Project"
                        onClick={(e) => openEditModal(project, e)}
                      >
                        <Edit3 size={12} />
                      </button>

                      <button
                        type="button"
                        className="cf-btn cf-btn-sm cf-btn-outline"
                        title="Duplicate Project Workspace"
                        onClick={(e) => handleDuplicate(project.id, e)}
                      >
                        <Copy size={12} />
                      </button>

                      <button
                        type="button"
                        className="cf-btn cf-btn-sm cf-btn-outline text-danger"
                        title="Delete Project Workspace"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProjectId(project.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-0 border hairline-border shadow">
              <div className="modal-header rounded-0 bg-light hairline-b">
                <h5 className="modal-title heading-display h6 mb-0">Create New Project Workspace</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)} />
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body p-4">
                  {errorMessage && (
                    <div className="p-2 mb-3 border border-danger bg-danger-subtle text-danger font-sans text-xs">
                      {errorMessage}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">PROJECT NAME *</label>
                    <input
                      type="text"
                      className="cf-input w-100"
                      placeholder="e.g. Q3 Investor Dossiers"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">DESCRIPTION (OPTIONAL)</label>
                    <textarea
                      className="cf-input w-100"
                      rows={3}
                      placeholder="Summary of this project's research topic or portfolio scope..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">TAGS (COMMA SEPARATED)</label>
                    <input
                      type="text"
                      className="cf-input w-100"
                      placeholder="Energy, Executive, Quarterly"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                  <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                    CANCEL
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'CREATING...' : 'CREATE PROJECT'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Rename Project Modal */}
      {editingProject && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-0 border hairline-border shadow">
              <div className="modal-header rounded-0 bg-light hairline-b">
                <h5 className="modal-title heading-display h6 mb-0">Edit Project: {editingProject.name}</h5>
                <button type="button" className="btn-close" onClick={() => setEditingProject(null)} />
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body p-4">
                  {errorMessage && (
                    <div className="p-2 mb-3 border border-danger bg-danger-subtle text-danger font-sans text-xs">
                      {errorMessage}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">PROJECT NAME *</label>
                    <input
                      type="text"
                      className="cf-input w-100"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">DESCRIPTION</label>
                    <textarea
                      className="cf-input w-100"
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">TAGS (COMMA SEPARATED)</label>
                    <input
                      type="text"
                      className="cf-input w-100"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">STATUS</label>
                    <select
                      className="cf-input w-100"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                  <Button variant="outline" size="sm" onClick={() => setEditingProject(null)}>
                    CANCEL
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProjectId && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-0 border border-danger shadow">
              <div className="modal-header rounded-0 bg-danger-subtle text-danger hairline-b">
                <div className="d-flex align-items-center gap-2">
                  <AlertTriangle size={18} />
                  <h5 className="modal-title heading-display h6 mb-0">Confirm Project Deletion</h5>
                </div>
                <button type="button" className="btn-close" onClick={() => setDeletingProjectId(null)} />
              </div>
              <div className="modal-body p-4 font-sans text-xs">
                <p className="mb-2 text-dark">
                  Are you sure you want to delete this project workspace?
                </p>
                <p className="text-muted mb-0">
                  Deleting a project workspace will disassociate its transformations. Your generated outputs and transformation history will remain safely preserved in your history ledger.
                </p>
              </div>
              <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                <Button variant="outline" size="sm" onClick={() => setDeletingProjectId(null)}>
                  CANCEL
                </Button>
                <Button variant="primary" size="sm" onClick={handleDeleteConfirm} disabled={isSubmitting}>
                  {isSubmitting ? 'DELETING...' : 'YES, DELETE PROJECT'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
