
import React, { useRef, useState, useEffect, useCallback } from "react";
import { uploadToSupabaseStorage } from "@/api/storage";
import { createStepImage, deleteStepImage, updateStepImage, listStepImages } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator"; // New import
import {
  Upload,
  Trash2,
  Eye,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Maximize2,
  X,
  Download,
  CheckSquare,
  Square,
  Search,
  Filter,
  ArrowUpDown,
  ArrowDownUp,
  Image as ImageIcon,
  MinusCircle,
  FolderOpen,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Tag,
  FolderPlus,
  Edit,
  Plus,
  MoreVertical,
  Move,
  Copy,
  Expand,
  Minimize2,
  Target // New import
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import ImageUploadDialog from "./ImageUploadDialog";

export default function ImagePortal({
  currentStep,
  stepImages,
  currentImageIndex,
  onImageIndexChange,
  onImagesUpdate,
  projectId // Added projectId prop as per outline
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selection state
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Grouping state
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [editingImageId, setEditingImageId] = useState(null);

  // New state for upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // New state for group management
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(null);
  const [editingGroupNewName, setEditingGroupNewName] = useState("");
  const [createdEmptyGroups, setCreatedEmptyGroups] = useState(new Set()); // Track empty groups

  // Selection state additions
  const [selectedGroups, setSelectedGroups] = useState(new Set()); // Track selected groups


  const currentImage = stepImages[currentImageIndex];

  const deleteImage = async (imageId) => {
    try {
      await deleteStepImage(imageId);
      onImagesUpdate();

      const deletedImageOriginalIndex = stepImages.findIndex(img => img.id === imageId);
      if (currentImageIndex === deletedImageOriginalIndex) {
        onImageIndexChange(Math.max(0, stepImages.length - 2));
      } else if (currentImageIndex > deletedImageOriginalIndex) {
        onImageIndexChange(currentImageIndex - 1);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.size === 0) return;

    setIsDeleting(true);
    try {
      for (const imageId of selectedImages) {
        await deleteStepImage(imageId);
      }

      setSelectedImages(new Set());
      setIsSelectionMode(false);
      onImagesUpdate();
      onImageIndexChange(0);
    } catch (error) {
      console.error("Error deleting selected images:", error);
    }
    setIsDeleting(false);
  };

  // Group management functions
  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const updateImageGroup = async (imageId, newGroup) => {
    try {
      await updateStepImage(imageId, { image_group: newGroup });
      onImagesUpdate();
      setEditingImageId(null);
    } catch (error) {
      console.error("Error updating image group:", error);
    }
  };

  // Enhanced group management functions
  const createNewGroup = async () => {
    if (!newGroupName.trim()) return;

    const groupName = newGroupName.trim();
    // Add to our tracking of empty groups so it shows in the UI
    setCreatedEmptyGroups(prev => new Set([...prev, groupName]));

    setNewGroupName("");
    setShowGroupDialog(false);
  };

  const renameGroup = async (oldGroupName, newGroupName) => {
    if (!newGroupName.trim() || oldGroupName === newGroupName.trim()) {
      setEditingGroupName(null); // Exit editing mode even if name is invalid or same
      setEditingGroupNewName("");
      return;
    }

    try {
      const imagesToUpdate = stepImages.filter(img =>
        (img.image_group || 'Untagged') === oldGroupName
      );

      for (const image of imagesToUpdate) {
        await updateStepImage(image.id, { image_group: newGroupName.trim() });
      }

      // Update empty groups tracking
      if (createdEmptyGroups.has(oldGroupName)) {
        setCreatedEmptyGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(oldGroupName);
          newSet.add(newGroupName.trim());
          return newSet;
        });
      }

      onImagesUpdate();
      setEditingGroupName(null);
      setEditingGroupNewName("");
    } catch (error) {
      console.error("Error renaming group:", error);
    }
  };

  const deleteGroup = async (groupName) => {
    if (!groupName || groupName === 'Untagged') return; // Prevent deleting the default group

    try {
      const imagesToMove = stepImages.filter(img =>
        (img.image_group || 'Untagged') === groupName
      );

      for (const image of imagesToMove) {
        await updateStepImage(image.id, { image_group: 'Untagged' });
      }

      // Remove from empty groups tracking
      setCreatedEmptyGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupName);
        return newSet;
      });

      // Remove from selected groups if it was selected
      setSelectedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupName);
        return newSet;
      });

      onImagesUpdate();
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  const moveSelectedToGroup = async (groupName) => {
    if (selectedImages.size === 0) return;

    try {
      for (const imageId of selectedImages) {
        await updateStepImage(imageId, { image_group: groupName });
      }
      onImagesUpdate();
      setSelectedImages(new Set());
      setSelectedGroups(new Set()); // Clear selected groups as well
      setIsSelectionMode(false);
    } catch (error) {
      console.error("Error moving images to group:", error);
    }
  };

  const moveImageToGroup = async (imageId, newGroup) => {
    try {
      await updateStepImage(imageId, { image_group: newGroup });

      // Remove the group from empty groups tracking once it has images
      if (createdEmptyGroups.has(newGroup)) {
        setCreatedEmptyGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(newGroup);
          return newSet;
        });
      }

      onImagesUpdate();
    } catch (error) {
      console.error("Error moving image:", error);
    }
  };

  // Expand/Collapse all groups
  const expandAllGroups = () => {
    setCollapsedGroups(new Set());
  };

  const collapseAllGroups = () => {
    const allGroups = Object.keys(groupedImages);
    setCollapsedGroups(new Set(allGroups));
  };


  // Selection handlers
  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(imageId)) {
        newSelection.delete(imageId);
      } else {
        newSelection.add(imageId);
      }
      return newSelection;
    });
  };

  const toggleGroupSelection = (groupName) => {
    if (!isSelectionMode) return;

    const groupImages = groupedImages[groupName] || [];
    const groupImageIds = groupImages.map(img => img.id);

    setSelectedGroups(prev => {
      const newSelection = new Set(prev);
      const isGroupSelected = newSelection.has(groupName);

      if (isGroupSelected) {
        newSelection.delete(groupName);
        // Deselect all images in this group
        setSelectedImages(prevImages => {
          const newImages = new Set(prevImages);
          groupImageIds.forEach(id => newImages.delete(id));
          return newImages;
        });
      } else {
        newSelection.add(groupName);
        // Select all images in this group
        setSelectedImages(prevImages => {
          const newImages = new Set(prevImages);
          groupImageIds.forEach(id => newImages.add(id));
          return newImages;
        });
      }

      return newSelection;
    });
  };


  const selectAllImages = () => {
    const allImageIds = new Set(groupedAndFilteredImages.map(img => img.id));
    setSelectedImages(allImageIds);
    setSelectedGroups(new Set(Object.keys(groupedImages)));
  };

  const clearSelection = () => {
    setSelectedImages(new Set());
    setSelectedGroups(new Set());
  };

  // Removed toggleSelectionMode function as its logic is now inline

  const handleImageClick = (imageId, event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (isSelectionMode) {
        toggleImageSelection(imageId);
      }
    } else {
      toggleImageSelection(imageId);
    }
  };

  const handleImageDoubleClick = (image, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Navigate to this image in the canvas
    const imageIndex = stepImages.findIndex(img => img.id === image.id);
    if (imageIndex !== -1) {
      onImageIndexChange(imageIndex);
    }
    
    // Open preview
    openPreview(image);
  };

  const toggleNoAnnotationsNeeded = async (image) => {
    if (!image) return;
    const nextValue = !image.no_annotations_needed;
    try {
      await updateStepImage(image.id, { no_annotations_needed: nextValue });
      if (onImagesUpdate) {
        await onImagesUpdate();
      }
    } catch (error) {
      console.error("Error updating no-annotations flag:", error);
    }
  };

  // Navigation handlers
  const navigateToNextImage = () => {
    if (groupedAndFilteredImages.length === 0) return;

    const currentFilteredIndex = groupedAndFilteredImages.findIndex(img =>
      stepImages.findIndex(original => original.id === img.id) === currentImageIndex
    );

    if (currentFilteredIndex !== -1 && currentFilteredIndex < groupedAndFilteredImages.length - 1) {
      const nextImage = groupedAndFilteredImages[currentFilteredIndex + 1];
      const nextOriginalIndex = stepImages.findIndex(img => img.id === nextImage.id);
      onImageIndexChange(nextOriginalIndex);
    }
  };

  const navigateToPrevImage = () => {
    if (groupedAndFilteredImages.length === 0) return;

    const currentFilteredIndex = groupedAndFilteredImages.findIndex(img =>
      stepImages.findIndex(original => original.id === img.id) === currentImageIndex
    );

    if (currentFilteredIndex > 0) {
      const prevImage = groupedAndFilteredImages[currentFilteredIndex - 1];
      const prevOriginalIndex = stepImages.findIndex(img => img.id === prevImage.id);
      onImageIndexChange(prevOriginalIndex);
    }
  };

  const openPreview = (image) => {
    setPreviewImage(image);
    setShowPreview(true);
  };

  // Utility functions
  const normalizeStorageUrl = (url) => {
    if (!url) return url;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const publicDupMatch = path.match(/\/storage\/v1\/object\/public\/([^/]+)\/\1\//);
      const objectDupMatch = path.match(/\/storage\/v1\/object\/([^/]+)\/\1\//);
      if (publicDupMatch) {
        parsed.pathname = path.replace(
          `/storage/v1/object/public/${publicDupMatch[1]}/${publicDupMatch[1]}/`,
          `/storage/v1/object/public/${publicDupMatch[1]}/`
        );
      } else if (objectDupMatch) {
        parsed.pathname = path.replace(
          `/storage/v1/object/${objectDupMatch[1]}/${objectDupMatch[1]}/`,
          `/storage/v1/object/${objectDupMatch[1]}/`
        );
      }
      return parsed.toString();
    } catch (error) {
      return url;
    }
  };

  const buildRenderUrl = (url, { width, height, resize } = {}) => {
    if (!url) return url;
    try {
      const parsed = new URL(normalizeStorageUrl(url));
      const publicPrefix = "/storage/v1/object/public/";
      const renderPrefix = "/storage/v1/render/image/public/";

      if (parsed.pathname.includes(renderPrefix)) {
        // Keep as render endpoint, just update params.
      } else if (parsed.pathname.includes(publicPrefix)) {
        parsed.pathname = parsed.pathname.replace(publicPrefix, renderPrefix);
      } else {
        return url;
      }

      const params = new URLSearchParams(parsed.search);
      if (width) params.set("width", String(width));
      if (height) params.set("height", String(height));
      if (resize) params.set("resize", resize);
      parsed.search = params.toString();
      return parsed.toString();
    } catch (error) {
      return url;
    }
  };

  const getImageUrl = (image, context = 'full') => {
    const baseUrl = image?.image_url || image?.display_url || image?.thumbnail_url;
    switch (context) {
      case 'thumbnail':
        return buildRenderUrl(
          image.thumbnail_url || image.display_url || image.image_url,
          { width: 300, height: 300, resize: "cover" }
        );
      case 'display':
        return buildRenderUrl(
          image.display_url || image.image_url,
          { width: 1200, resize: "contain" }
        );
      case 'full':
      default:
        return normalizeStorageUrl(baseUrl);
    }
  };

  const isImageProcessing = (image) => {
    return image.processing_status === 'processing';
  };

  const formatFileSize = (bytes) => {
    if (bytes === null || bytes === undefined) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getImageAnnotationStatus = useCallback((image) => {
    if (isImageProcessing(image)) return 'pending';
    if (image?.no_annotations_needed) return 'skipped';
    const imageAnnotations = Array.isArray(image?.annotations)
      ? image.annotations
      : (image?.annotations?.annotations || []);
    return imageAnnotations.length > 0 ? 'completed' : 'pending';
  }, []);


  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'skipped':
        return <MinusCircle className="w-4 h-4 text-slate-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Annotated</Badge>;
      case 'skipped':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">No annotations</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get available groups - include empty groups
  const allAvailableGroups = React.useMemo(() => {
    const imageGroups = new Set(stepImages.map(img => img.image_group).filter(Boolean));
    const allGroups = new Set(['Untagged', ...imageGroups, ...createdEmptyGroups]);
    return Array.from(allGroups).sort();
  }, [stepImages, createdEmptyGroups]);


  // Filter and group images
  const groupedAndFilteredImages = React.useMemo(() => {
    let filtered = stepImages.filter(image => {
      // Search filter
      if (searchTerm && !image.image_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all') {
        const status = getImageAnnotationStatus(image);
        if (filterStatus === 'annotated' && !['completed', 'skipped'].includes(status)) return false;
        if (filterStatus === 'pending' && status !== 'pending') return false;
      }

      // Group filter
      if (filterGroup !== 'all') {
        const imageGroup = image.image_group || 'Untagged';
        if (imageGroup !== filterGroup) return false;
      }

      return true;
    });

    // Sort within each group
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.image_name.localeCompare(b.image_name);
          break;
        case 'size':
          comparison = (a.file_size || 0) - (b.file_size || 0);
          break;
        case 'date':
          comparison = new Date(a.created_at || a.created_date) - new Date(b.created_at || b.created_date);
          break;
        default:
          comparison = a.image_name.localeCompare(b.image_name);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [stepImages, searchTerm, filterStatus, filterGroup, sortBy, sortOrder, getImageAnnotationStatus]);

  // Group the filtered images - include empty groups
  const groupedImages = React.useMemo(() => {
    const groups = {};
    
    // Initialize all groups (including empty ones)
    allAvailableGroups.forEach(group => {
      groups[group] = [];
    });
    
    // Add images to their respective groups
    groupedAndFilteredImages.forEach(image => {
      const group = image.image_group || 'Untagged';
      if (groups[group]) {
        groups[group].push(image);
      } else {
        groups[group] = [image];
      }
    });
    
    // Remove empty groups if they don't have images and aren't in createdEmptyGroups
    Object.keys(groups).forEach(groupName => {
      if (groups[groupName].length === 0 && !createdEmptyGroups.has(groupName)) {
        delete groups[groupName];
      }
    });
    
    return groups;
  }, [groupedAndFilteredImages, allAvailableGroups, createdEmptyGroups]);

  // Selection state derived values
  const areAllSelected = selectedImages.size > 0 && selectedImages.size === groupedAndFilteredImages.length;
  const areSomeSelected = selectedImages.size > 0 && selectedImages.size < groupedAndFilteredImages.length;

  // Context menu component for images
  const ImageContextMenu = ({ image, children }) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => {
            const imageIndex = stepImages.findIndex(img => img.id === image.id);
            if (imageIndex !== -1) {
              onImageIndexChange(imageIndex);
              setViewMode('viewer'); // Switch to viewer mode
            }
          }}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Image
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openPreview(image)}>
          <Maximize2 className="w-4 h-4 mr-2" />
          Full Preview
        </ContextMenuItem>
        <ContextMenuItem onClick={() => toggleNoAnnotationsNeeded(image)}>
          <MinusCircle className="w-4 h-4 mr-2" />
          {image.no_annotations_needed ? "Clear No Annotations" : "Mark No Annotations"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {allAvailableGroups.map(group => {
          const currentGroup = image.image_group || 'Untagged';
          if (group === currentGroup) return null;
          return (
            <ContextMenuItem
              key={group}
              onClick={(e) => {
                e.stopPropagation(); // Prevent parent click handlers
                moveImageToGroup(image.id, group);
              }}
            >
              <Move className="w-4 h-4 mr-2" />
              Move to {group}
            </ContextMenuItem>
          );
        })}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation(); // Prevent parent click handlers
            deleteImage(image.id);
          }}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Image
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  // Group header component with actions
  const GroupHeader = ({ groupName, imageCount }) => {
    const isGroupSelected = selectedGroups.has(groupName);
    const groupImages = groupedImages[groupName] || [];
    const allImagesInGroupSelected = groupImages.length > 0 && groupImages.every(img => selectedImages.has(img.id));

    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
        <div
          className="flex items-center gap-3 flex-1"
          onClick={() => isSelectionMode ? toggleGroupSelection(groupName) : toggleGroupCollapse(groupName)}
        >
          {isSelectionMode && (
            <Checkbox
              checked={isGroupSelected || allImagesInGroupSelected}
              onCheckedChange={() => toggleGroupSelection(groupName)}
              onClick={(e) => e.stopPropagation()}
              className="mr-2"
            />
          )}

          {!isSelectionMode && (
            <>
              {collapsedGroups.has(groupName) ? (
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </>
          )}

          <FolderOpen className="w-5 h-5 text-gray-600" />
          {editingGroupName === groupName ? (
            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}> {/* Stop propagation to prevent collapse on input click */}
              <Input
                value={editingGroupNewName}
                onChange={(e) => setEditingGroupNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameGroup(groupName, editingGroupNewName);
                  } else if (e.key === 'Escape') {
                    setEditingGroupName(null);
                    setEditingGroupNewName("");
                  }
                }}
                onBlur={() => renameGroup(groupName, editingGroupNewName)}
                className="h-8 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()} // Stop propagation to prevent group collapse when clicking the input
              />
            </div>
          ) : (
            <h3 className={`font-semibold flex-1 ${isGroupSelected || allImagesInGroupSelected ? 'text-blue-700' : 'text-gray-900'}`}>
              {groupName}
            </h3>
          )}
          <Badge variant="outline" className="text-xs">
            {imageCount} image{imageCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        {!isSelectionMode && groupName !== 'Untagged' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingGroupName(groupName);
                  setEditingGroupNewName(groupName);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Rename Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  deleteGroup(groupName);
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };


  if (!currentStep) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a step to manage images</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Enhanced Header with Current Image Highlight */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Images</h2>
            <Badge variant="outline" className="text-sm">
              {stepImages.length} total
            </Badge>
            {currentImage && (
              <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 rounded-lg border border-teal-200">
                <Target className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-900">
                  Currently viewing: {currentImage.image_name}
                </span>
                <Badge className="bg-teal-600 text-white text-xs">
                  {currentImage.image_group || 'Untagged'}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Group expand/collapse controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAllGroups}
                title="Expand all groups"
              >
                <Expand className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAllGroups}
                title="Collapse all groups"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Selection mode toggle */}
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) {
                  setSelectedImages(new Set());
                  setSelectedGroups(new Set());
                }
              }}
              className={isSelectionMode ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {isSelectionMode ? 'Exit Selection' : 'Select'}
            </Button>

            {/* Create group button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGroupDialog(true)}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Group
            </Button>

            {/* Upload button */}
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Images
            </Button>
          </div>
        </div>

        {/* Selection Controls */}
        <AnimatePresence>
          {isSelectionMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={areAllSelected}
                    ref={checkbox => {
                      if (checkbox) checkbox.indeterminate = areSomeSelected;
                    }}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllImages();
                      } else {
                        clearSelection();
                      }
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {areAllSelected ? 'Deselect All' : areSomeSelected ? 'Deselect All' : 'Select All'}
                  </span>
                  {selectedImages.size > 0 && (
                    <Badge className="bg-blue-100 text-blue-800">
                      {selectedImages.size} selected
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedImages.size > 0 && (
                    <>
                      <Select onValueChange={moveSelectedToGroup}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Move to group..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allAvailableGroups.map(group => (
                            <SelectItem key={group} value={group}>
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-3 h-3" />
                                {group}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedImages}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>Deleting...</>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Selected ({selectedImages.size})
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed Controls Bar - View Mode Tabs and Filters */}
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-fit grid-cols-3">
              <TabsTrigger value="viewer" className="flex items-center gap-2" disabled={isSelectionMode}>
                <Eye className="w-4 h-4" />
                Viewer
              </TabsTrigger>
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {/* No Group Management Controls here, moved to main header */}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>

              {/* Filters */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="annotated">Annotated</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {allAvailableGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <ArrowUpDown className="w-4 h-4" /> : <ArrowDownUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0">
        <Tabs value={viewMode} className="h-full flex flex-col">
          <TabsContent value="viewer" className="flex-1 min-h-0 m-0">
            {stepImages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Images Yet</h3>
                  <p className="text-gray-600 mb-6">Upload images to start annotating this step</p>
                  <Button
                    onClick={() => setShowUploadDialog(true)}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Images
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 h-full p-4">
                {/* Main Viewer - Fixed sizing */}
                <div className="flex-1 flex flex-col min-h-0">
                  <Card className="flex-1 min-h-0 glass-effect border-0 shadow-lg flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {currentImageIndex + 1} of {stepImages.length}
                          </Badge>
                          {currentImage?.is_primary && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              <Star className="w-3 h-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                          {currentImage && (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                              <Tag className="w-3 h-3 mr-1" />
                              {currentImage.image_group || 'Untagged'}
                            </Badge>
                          )}
                          {currentImage && getStatusBadge(getImageAnnotationStatus(currentImage))}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={navigateToPrevImage}
                            disabled={groupedAndFilteredImages.length === 0 ||
                              groupedAndFilteredImages.findIndex(img =>
                                stepImages.findIndex(original => original.id === img.id) === currentImageIndex
                              ) === 0}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={navigateToNextImage}
                            disabled={groupedAndFilteredImages.length === 0 ||
                              groupedAndFilteredImages.findIndex(img =>
                                stepImages.findIndex(original => original.id === img.id) === currentImageIndex
                              ) === groupedAndFilteredImages.length - 1}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreview(currentImage)}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Fixed Image Container */}
                    <CardContent className="flex-1 min-h-0 p-4">
                      {currentImage ? (
                        isImageProcessing(currentImage) ? (
                          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center flex-col">
                            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-lg text-gray-500">Processing image...</p>
                            <p className="text-sm text-gray-400">Please wait</p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={getImageUrl(currentImage, 'display')}
                              alt={currentImage.image_name}
                              className="max-w-full max-h-full object-contain"
                              style={{ imageRendering: 'high-quality' }}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                          <p className="text-gray-500">No image selected</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Image Details Sidebar */}
                <Card className="w-80 glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Image Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentImage ? (
                      <>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">File Info</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Name:</span>
                              <span className="font-medium truncate ml-2" title={currentImage.image_name}>
                                {currentImage.image_name}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Size:</span>
                              <span>{formatFileSize(currentImage.file_size)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Status:</span>
                              {getStatusBadge(getImageAnnotationStatus(currentImage))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">Group</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingImageId(currentImage.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                          {editingImageId === currentImage.id ? (
                            <div className="space-y-2">
                              <Select
                                value={currentImage.image_group || 'Untagged'}
                                onValueChange={(value) => updateImageGroup(currentImage.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {allAvailableGroups.map(group => (
                                    <SelectItem key={group} value={group}>{group}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setEditingImageId(null)}
                                  className="flex-1"
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                              <Tag className="w-3 h-3 mr-1" />
                              {currentImage.image_group || 'Untagged'}
                            </Badge>
                          )}
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteImage(currentImage.id)}
                            className="w-full text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Image
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500">No image selected</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="grid" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {Object.keys(groupedImages).length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Images Found</h3>
                    <p className="text-gray-600">Try adjusting your filters or upload some images</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedImages).map(([groupName, images]) => (
                      <div key={groupName} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <GroupHeader groupName={groupName} imageCount={images.length} />

                        {/* Group Content */}
                        <AnimatePresence>
                          {!collapsedGroups.has(groupName) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3">
                                {images.length === 0 ? (
                                  <div className="text-center py-8 text-gray-500">
                                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">This group is empty</p>
                                    <p className="text-xs mt-1">Upload images or move them here</p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16 gap-2">
                                    {images.map((image) => (
                                      <ImageContextMenu key={image.id} image={image}>
                                        <div
                                          className={`group relative bg-white rounded border transition-all duration-200 cursor-pointer hover:shadow-sm hover:scale-105 ${
                                            isSelectionMode && selectedImages.has(image.id)
                                              ? 'border-blue-500 bg-blue-50/70 shadow-md ring-2 ring-blue-400'
                                              : stepImages.findIndex(img => img.id === image.id) === currentImageIndex
                                                ? 'border-teal-500 shadow-md ring-2 ring-teal-200 bg-teal-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                          }`}
                                          onClick={(e) => handleImageClick(image.id, e)}
                                          onDoubleClick={(e) => handleImageDoubleClick(image, e)}
                                        >
                                          {/* Current image indicator */}
                                          {stepImages.findIndex(img => img.id === image.id) === currentImageIndex && (
                                            <div className="absolute -top-1 -right-1 z-10">
                                              <div className="w-3 h-3 bg-teal-600 rounded-full border-2 border-white shadow-sm"></div>
                                            </div>
                                          )}

                                          {/* Smaller square thumbnail */}
                                          <div className="aspect-square overflow-hidden rounded-t">
                                            {isImageProcessing(image) ? (
                                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                              </div>
                                            ) : (
                                              <img
                                                src={getImageUrl(image, 'thumbnail')}
                                                alt={image.image_name}
                                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                                loading="lazy"
                                                decoding="async"
                                                style={{ imageRendering: 'crisp-edges' }}
                                              />
                                            )}
                                            {/* Overlay for selection and status */}
                                            <div
                                              className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                                              onClick={(e) => {
                                                if (isSelectionMode) return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                openPreview(image);
                                              }}
                                              role="button"
                                              aria-label="Open preview"
                                            >
                                              {!isSelectionMode && (
                                                <Eye className="w-3 h-3 text-white drop-shadow-sm" />
                                              )}
                                            </div>
                                          </div>

                                          {/* Compact info bar */}
                                          <div className="p-1">
                                            <div className="flex items-center justify-between">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-900 truncate" title={image.image_name}>
                                                  {image.image_name.length > 8 ? `${image.image_name.substring(0, 8)}...` : image.image_name}
                                                </p>
                                              </div>
                                              <div className="ml-1">
                                                {getStatusIcon(getImageAnnotationStatus(image))}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Selection checkbox - smaller */}
                                          {isSelectionMode && (
                                            <div className="absolute top-1 left-1">
                                              <Checkbox
                                                checked={selectedImages.has(image.id)}
                                                className="h-3 w-3 bg-white shadow-sm border-gray-400"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                            </div>
                                          )}

                                          {/* Primary star - smaller */}
                                          {image.is_primary && (
                                            <div className={`absolute top-1 ${isSelectionMode && selectedImages.has(image.id) ? "right-5" : "right-1"}`}>
                                              <Star className="w-3 h-3 text-amber-500 fill-current drop-shadow-sm" />
                                            </div>
                                          )}
                                          {isSelectionMode && selectedImages.has(image.id) && (
                                            <div className="absolute top-1 right-1">
                                              <CheckCircle className="w-3 h-3 text-blue-600 bg-white rounded-full" />
                                            </div>
                                          )}
                                          {image.no_annotations_needed && (
                                            <div className="absolute bottom-1 left-1">
                                              <div className="px-1.5 py-0.5 rounded bg-slate-700/90 text-white text-[10px]">
                                                No ann.
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </ImageContextMenu>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="list" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {Object.keys(groupedImages).length === 0 ? (
                  <div className="text-center py-12">
                    <List className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Images Found</h3>
                    <p className="text-gray-600">Try adjusting your filters or upload some images</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedImages).map(([groupName, images]) => (
                      <div key={groupName} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <GroupHeader groupName={groupName} imageCount={images.length} />

                        {/* Group Content */}
                        <AnimatePresence>
                          {!collapsedGroups.has(groupName) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="divide-y divide-gray-200">
                                {images.map((image) => (
                                  <ImageContextMenu key={image.id} image={image}>
                                    <div
                                      className={`flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                                        isSelectionMode && selectedImages.has(image.id)
                                          ? 'bg-blue-50 border-l-4 border-blue-500 ring-1 ring-blue-200'
                                          : stepImages.findIndex(img => img.id === image.id) === currentImageIndex
                                            ? 'bg-teal-50 border-l-4 border-teal-500'
                                            : ''
                                      }`}
                                      onClick={(e) => handleImageClick(image.id, e)}
                                      onDoubleClick={(e) => handleImageDoubleClick(image, e)}
                                    >
                                      {isSelectionMode && (
                                        <Checkbox
                                          checked={selectedImages.has(image.id)}
                                          onCheckedChange={() => toggleImageSelection(image.id)}
                                          onClick={(e) => e.stopPropagation()} // Prevent parent div click from being triggered
                                        />
                                      )}

                                      <div className="w-16 h-16 flex-shrink-0">
                                        {isImageProcessing(image) ? (
                                          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                                            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                          </div>
                                        ) : (
                                          <img
                                            src={getImageUrl(image, 'thumbnail')}
                                            alt={image.image_name}
                                            className="w-full h-full object-cover rounded-lg"
                                            loading="lazy"
                                            decoding="async"
                                          />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="font-medium text-gray-900 truncate" title={image.image_name}>
                                            {image.image_name}
                                          </h4>
                                          {image.is_primary && (
                                            <Star className="w-4 h-4 text-amber-500 fill-current flex-shrink-0" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                          <span>{formatFileSize(image.file_size)}</span>
                      <span>{new Date(image.created_at || image.created_date).toLocaleDateString()}</span>
                                          {getStatusBadge(getImageAnnotationStatus(image))}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {isSelectionMode && selectedImages.has(image.id) && (
                                          <CheckCircle className="w-4 h-4 text-blue-600" />
                                        )}
                                        {!isSelectionMode && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openPreview(image);
                                              }}
                                            >
                                              <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleNoAnnotationsNeeded(image);
                                              }}
                                              title={image.no_annotations_needed ? "Clear no annotations" : "Mark no annotations"}
                                            >
                                              <MinusCircle className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </ImageContextMenu>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{previewImage?.image_name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex items-center justify-center max-h-[80vh]">
              <img
                src={getImageUrl(previewImage, 'full')}
                alt={previewImage.image_name}
                className="max-w-full max-h-full object-contain"
                style={{ imageRendering: 'high-quality' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Enter a name for the new image group. You can then move images into this group.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Group name (e.g., Validation, Test Set)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  createNewGroup();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewGroup} disabled={!newGroupName.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <ImageUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadComplete={onImagesUpdate}
        currentStepId={currentStep?.id}
        currentStep={currentStep}
        projectId={projectId} // Pass projectId to ImageUploadDialog
      />
    </div>
  );
}
