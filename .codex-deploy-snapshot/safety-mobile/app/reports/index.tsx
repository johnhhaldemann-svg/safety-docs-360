import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Linking, Pressable } from "react-native";
import { getReportLink, listReports } from "@/api/mobile";
import { EmptyState, ErrorState, LoadingState, StatusBanner } from "@/components/Enterprise";
import { RegisterRow } from "@/components/ListPrimitives";
import { Screen } from "@/components/Screen";

type ReportRow = {
  id: string;
  title?: string | null;
  report_type?: string | null;
  status?: string | null;
  file_path?: string | null;
  generated_at?: string | null;
  updated_at?: string | null;
};

export default function ReportsScreen() {
  const { data = [], isLoading, error, refetch } = useQuery<ReportRow[]>({ queryKey: ["reports"], queryFn: listReports });
  const openMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const link = await getReportLink(filePath);
      await Linking.openURL(link.signedUrl);
    },
    onError: (openError) => Alert.alert("Report failed", openError instanceof Error ? openError.message : "Could not open report."),
  });

  return (
    <Screen title="Reports" subtitle="Published reports available to field users.">
      <StatusBanner title="Published Only" detail="Mobile shows published reports and opens signed links for a short time." tone="info" />
      {isLoading ? <LoadingState title="Loading reports..." /> : null}
      {error ? <ErrorState title="Reports Not Loaded" detail={error instanceof Error ? error.message : "Try again."} onRetry={() => void refetch()} /> : null}
      {!isLoading && !error && data.length === 0 ? <EmptyState title="No Reports" detail="Published reports will appear here." /> : null}
      {data.map((report) => (
        <Pressable
          key={report.id}
          onPress={() => (report.file_path ? openMutation.mutate(report.file_path) : Alert.alert("Report unavailable", "No report file has been attached yet."))}
          disabled={openMutation.isPending}
        >
          <RegisterRow
            title={report.title || "Report"}
            meta={labelize(report.report_type)}
            badge={report.status ?? "published"}
            detail={report.file_path ? "Tap to open from the web platform." : "No report file has been attached yet."}
          />
        </Pressable>
      ))}
    </Screen>
  );
}

function labelize(value?: string | null) {
  return String(value ?? "report").replaceAll("_", " ");
}
