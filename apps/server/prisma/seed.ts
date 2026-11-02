/**
 * Dev seed: one school, one teacher, one class of students, and the default
 * middle-school art & design rubric. Descriptors are placeholders — replace
 * with educator-authored text after the Phase 0 rubric sessions.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RUBRIC_CRITERIA } from '@progressflow/shared';

const prisma = new PrismaClient();

function joinCode(): string {
  return randomUUID()
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 6);
}

const placeholderDescriptors = (name: string) =>
  [1, 2, 3, 4].map((level) => ({
    level,
    label: ['Emerging', 'Developing', 'Proficient', 'Advanced'][level - 1],
    descriptor: `PLACEHOLDER — describe ${name.toLowerCase()} at level ${level}. Author with educators in Phase 0.`,
    exemplarImageKey: null,
  }));

async function main() {
  const school = await prisma.school.create({
    data: { name: 'Demo Government High School', district: 'Hyderabad' },
  });

  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: 'teacher',
      displayName: 'Demo Teacher',
      phone: '+919999900001',
      languagePref: 'te',
    },
  });

  const rubric = await prisma.rubric.create({
    data: {
      schoolId: null,
      title: 'Middle-school art & design',
      context: 'Classes VI–VIII',
      language: 'en',
      criteria: {
        create: DEFAULT_RUBRIC_CRITERIA.map((c) => ({
          key: c.key,
          name: c.name,
          order: c.order,
          descriptors: placeholderDescriptors(c.name),
        })),
      },
    },
  });

  const klass = await prisma.klass.create({
    data: {
      schoolId: school.id,
      teacherId: teacher.id,
      name: 'Class 7-B',
      grade: 7,
      section: 'B',
      academicYear: '2026-27',
    },
  });

  const roster = ['Aarav K.', 'Diya S.', 'Ishaan R.', 'Meera T.', 'Rohan P.'];
  for (const [i, name] of roster.entries()) {
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        displayName: name,
        joinCode: joinCode(),
        rollNo: String(i + 1),
      },
    });
    await prisma.enrollment.create({
      data: { klassId: klass.id, studentId: student.id },
    });
  }

  await prisma.assignment.create({
    data: {
      klassId: klass.id,
      rubricId: rubric.id,
      title: 'Still life — pencil',
      medium: 'Graphite on paper',
    },
  });

  console.log('Seeded school', school.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
