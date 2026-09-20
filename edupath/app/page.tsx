import { redirect } from "next/navigation";

export default function Home() {
  // TODO: Conectar con GET /api/learner cuando el endpoint esté listo
  redirect("/onboarding");
}