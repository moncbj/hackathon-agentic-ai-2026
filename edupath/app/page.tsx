import { redirect } from "next/navigation";

export default function Home() {
  // El dashboard usa datos de demostración mientras GET /api/learner queda disponible.
  redirect("/dashboard");
}
