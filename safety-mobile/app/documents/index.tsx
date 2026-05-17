import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Linking, Pressable } from "react-native";
import { getDocumentLink, listDocuments } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/Enterprise";
import { RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

type DocumentRow = {
  id: string;
  title?: string | null;
  document_title?: string | null;
  document_type?: string | null;
  status?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

export default function DocumentsScreen() {
  const { data = [], isLoading, error, refetch } = useQuery<DocumentRow[]>({ queryKey: ["documents"], queryFn: listDocuments });
  const openMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const link = await getDocumentLink(documentId);
      await Linking.openURL(link.signedUrl);
    },
    onError: (openError) => Alert.alert("Document failed", openError instanceof Error ? openError.message : "Could not open document."),
  });

  return (
    <Screen title="Documents" subtitle="Approved field documents with short-lived secure links.">
      <StatusBanner title="View Only" detail="Documents can be opened from mobile, but generation and editing stay on the web platform." tone="info" />
      {isLoading ? <LoadingState title="Loading documents..." /> : null}
      {error ? <ErrorState title="Documents Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && data.length === 0 ? <EmptyState title="No Documents" detail="Approved documents will appear here." /> : null}
      {data.map((document) => (
        <Pressable key={document.id} onPress={() => openMutation.mutate(document.id)} disabled={openMutation.isPending}>
          <RegisterRow
            title={document.document_title || document.title || "Document"}
            meta={labelize(document.document_type)}
            badge={document.status ?? "approved"}
            detail={openMutation.isPending ? "Opening secure link..." : "Tap to open from the web platform."}
          />
        </Pressable>
      ))}
    </Screen>
  );
}

function labelize(value?: string | null) {
  return String(value ?? "document").replaceAll("_", " ");
}
