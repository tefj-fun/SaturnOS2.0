import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit3 } from "lucide-react";

export default function EditVariantDialog({ open, variant, onOpenChange, onUpdateVariant }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    attributes: {}
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (variant) {
      setFormData({
        name: variant.name || "",
        description: variant.description || "",
        attributes: variant.attributes || {}
      });
    }
  }, [variant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !variant) return;

    setIsSubmitting(true);
    try {
      await onUpdateVariant(variant.id, formData);
    } catch (error) {
      console.error("Error updating variant:", error);
    }
    setIsSubmitting(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-effect border-0 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Edit3 className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Edit Build Variant
          </DialogTitle>
          <p className="text-gray-600">
            Update variant details
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
              Variant Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., Model X - Premium - Blue"
              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe this variant's characteristics"
              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 h-24 resize-none"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-lg"
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? "Updating..." : "Update Variant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}