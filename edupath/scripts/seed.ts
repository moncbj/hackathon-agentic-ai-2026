import fs from 'fs';
import path from 'path';
import { runSeed, SeedDataset } from '../lib/db/repositories/seed';

async function main() {
  const seedDir = path.join(process.cwd(), 'data', 'seed');

  const roles = JSON.parse(fs.readFileSync(path.join(seedDir, 'roles.json'), 'utf-8'));
  const skills = JSON.parse(fs.readFileSync(path.join(seedDir, 'skills.json'), 'utf-8'));
  const roleSkills = JSON.parse(fs.readFileSync(path.join(seedDir, 'role-skills.json'), 'utf-8'));
  const prerequisites = JSON.parse(fs.readFileSync(path.join(seedDir, 'skill-prerequisites.json'), 'utf-8'));
  const resources = JSON.parse(fs.readFileSync(path.join(seedDir, 'resources.json'), 'utf-8'));

  const dataset: SeedDataset = {
    roles,
    skills,
    roleSkills,
    prerequisites,
    resources,
  };

  console.log('Starting database seed process...');
  console.log(`- Roles: ${roles.length}`);
  console.log(`- Skills: ${skills.length}`);
  console.log(`- Role-Skills: ${roleSkills.length}`);
  console.log(`- Prerequisites: ${prerequisites.length}`);
  console.log(`- Resources: ${resources.length}`);

  try {
    const summary = await runSeed(dataset);
    console.log('\n✓ Database seed completed successfully:');
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Seed failed: ${message}`);
    process.exit(1);
  }
}

main();
