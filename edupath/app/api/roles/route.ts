import { NextResponse } from "next/server";
import { getRoles } from "@/lib/db/repositories/roles";
import { getSkillsByRole } from "@/lib/db/repositories/skills";

export async function GET() {
  try {
    const roles = await getRoles();
    const response = await Promise.all(roles.map(async (role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      skills: (await getSkillsByRole(role.id)).map(({ id, slug, name, description, category }) => ({ id, slug, name, description, category })),
    })));
    return NextResponse.json({ roles: response });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load roles", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
