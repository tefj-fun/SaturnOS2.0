import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2 } from "lucide-react";

export default function FileUploadZone({ onFileUpload, isUploading, progress }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === "application/pdf");
    
    if (pdfFile) {
      onFileUpload(pdfFile);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      onFileUpload(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="hidden"
        disabled={isUploading}
      />
      
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${
          dragActive 
            ? "border-teal-400 bg-teal-50" 
            : "border-gray-300 hover:border-gray-400"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className="text-center">
          {!isUploading ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-teal-50 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Upload Your SOP Document
              </h3>
              <p className="text-gray-600 mb-6">
                Drag and drop your PDF file here, or click to browse
              </p>
              <Button
                onClick={openFileDialog}
                className="bg-teal-600 hover:bg-teal-700 shadow-lg"
                size="lg"
              >
                <Upload className="w-5 h-5 mr-2" />
                Choose PDF File
              </Button>
              <p className="text-sm text-gray-500 mt-4">
                Only PDF files are supported
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-6">
                <Loader2 className="w-20 h-20 animate-spin text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Uploading Document...
              </h3>
              <p className="text-gray-600 mb-6">
                Please wait while we process your SOP document
              </p>
              <div className="w-64 mx-auto">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}