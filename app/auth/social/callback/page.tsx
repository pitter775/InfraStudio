import { redirect } from "next/navigation";

export default function SocialCallbackPage() {
  redirect("/?auth_notice=social_oauth_error");
}
