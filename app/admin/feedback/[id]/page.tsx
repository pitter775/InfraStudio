import { FeedbackDetalhePage } from "@/app/admin/feedback/_components/feedback-detalhe-page";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminFeedbackDetalheRoute(props: PageProps) {
  const { id } = await props.params;
  return <FeedbackDetalhePage feedbackId={id} />;
}
