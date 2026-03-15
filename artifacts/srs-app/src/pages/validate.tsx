import { DocumentCardValidation } from "@/components/document-card-validation";

export default function Validate() {
  const searchParams = new URLSearchParams(window.location.search);
  const documentId = searchParams.get("documentId") ?? "";

  if (!documentId) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <DocumentCardValidation documentId={documentId} />
      </div>
    </div>
  );
}
