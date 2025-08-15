import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { Smartphone, QrCode } from "lucide-react";

export default function ReviewOnPhoneDialog({ open, project, onOpenChange }) {
  if (!project) return null;

  const reviewUrl = `${window.location.origin}${createPageUrl(`AnnotationReview?projectId=${project.id}`)}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(reviewUrl)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-effect border-0 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Review on Your Phone
          </DialogTitle>
          <p className="text-gray-600">
            Scan the QR code to start reviewing annotations.
          </p>
        </DialogHeader>
        
        <div className="mt-6 flex flex-col items-center justify-center gap-6">
          <div className="p-4 bg-white rounded-lg shadow-inner">
            <img src={qrCodeApiUrl} alt="QR Code for Annotation Review" />
          </div>
          <div className="text-center text-sm text-gray-600 max-w-xs">
            <p>1. Open the camera app on your phone.</p>
            <p>2. Point it at the QR code.</p>
            <p>3. Tap the link that appears to start reviewing!</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}