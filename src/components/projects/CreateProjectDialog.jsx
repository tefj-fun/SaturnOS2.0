
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

export default function CreateProjectDialog({ open, onOpenChange, onCreateProject }) {
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateProject({
        ...formData,
        status: "created"
      });
      setFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating project:", error);
    }
    setIsSubmitting(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl border-0 bg-transparent p-0 shadow-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.65),_transparent_55%)]" />
          <div className="relative grid md:grid-cols-[1.05fr_1fr]">
            <div className="relative p-8 md:p-10 text-white">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-500 to-teal-700" />
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,_rgba(255,255,255,0.35),_transparent_45%),radial-gradient(circle_at_80%_10%,_rgba(255,255,255,0.2),_transparent_50%)]" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white/15 ring-1 ring-white/40 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold tracking-[0.35em] uppercase text-white/70">
                    Project Studio
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl font-semibold leading-tight">
                    Shape a new annotation project
                  </h2>
                  <p className="mt-3 text-sm text-white/80">
                    Name it, add context, then move straight into SOP upload to generate steps.
                  </p>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                    <span className="text-xs font-semibold text-white/70">01</span>
                    <span className="text-white/90">Define scope and labels</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                    <span className="text-xs font-semibold text-white/70">02</span>
                    <span className="text-white/90">Upload SOP for step extraction</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                    <span className="text-xs font-semibold text-white/70">03</span>
                    <span className="text-white/90">Start guided annotation</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative p-8 md:p-10">
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl font-semibold text-slate-900">
                  Create new project
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Keep it focused. You can refine details any time.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5 glass-effect rounded-2xl p-6 bg-white/70">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                    Project Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g. Retail Checkout QA"
                    className="border-slate-200 focus:border-teal-500 focus:ring-teal-500 bg-white/80"
                    required
                  />
                  <p className="text-xs text-slate-500">Short, clear, and task-specific.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="What is being annotated and why?"
                    className="border-slate-200 focus:border-teal-500 focus:ring-teal-500 h-24 resize-none bg-white/80"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 border-slate-200"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg"
                    disabled={isSubmitting || !formData.name.trim()}
                  >
                    {isSubmitting ? "Creating..." : "Create Project"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
