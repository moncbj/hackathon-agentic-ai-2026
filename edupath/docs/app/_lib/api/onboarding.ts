import { apiClient, getMockState, isMockMode } from './client';
import type { ApiError, Result } from './types';
import type {
    Learner,
    OnboardingRequest,
    ProfileExtractResponse,
    ProposedSkill,
    Role,
    RolesResponse,
    UnmappedSkill,
} from './onboarding-types';

const MOCK_DELAY_MS = 600;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const mockHttpError = (status: number, message: string): Result<never> => ({
    data: null,
    error: { type: 'http', message, status },
});

function postJson<T>(url: string, body: unknown): Promise<Result<T>> {
    return apiClient<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/** True when GET /api/learner answered 404, meaning nobody has onboarded yet. */
export function isNoLearnerError(error: ApiError | null): boolean {
    return error?.type === 'http' && error.status === 404;
}

export const MOCK_ROLE: Role = {
    id: 'mock-role-1',
    slug: 'data-analyst-junior',
    name: 'Data Analyst (junior)',
    description: 'Turns raw data into clear answers with SQL, spreadsheets, Python and visualization.',
    skills: [
        { slug: 'sql', name: 'SQL', description: 'Query and combine tables to answer questions.', category: 'Data foundations' },
        { slug: 'spreadsheets', name: 'Spreadsheets', description: 'Formulas, pivot tables and quick analysis.', category: 'Data foundations' },
        { slug: 'relational-modeling', name: 'Relational modeling', description: 'Tables, keys and relationships.', category: 'Data foundations' },
        { slug: 'descriptive-statistics', name: 'Descriptive statistics', description: 'Summarize data with averages, spread and distributions.', category: 'Statistics' },
        { slug: 'probability', name: 'Probability', description: 'Reason about chance and uncertainty.', category: 'Statistics' },
        { slug: 'basic-python', name: 'Basic Python', description: 'Variables, loops, functions and data structures.', category: 'Programming' },
        { slug: 'pandas', name: 'pandas', description: 'Load, transform and analyze tables in Python.', category: 'Programming' },
        { slug: 'basic-git', name: 'Basic Git', description: 'Commit, branch and collaborate on code.', category: 'Programming' },
        { slug: 'data-cleaning', name: 'Data cleaning', description: 'Fix missing, duplicated and inconsistent data.', category: 'Data preparation' },
        { slug: 'data-visualization', name: 'Data visualization', description: 'Choose and build charts that tell the story.', category: 'Communication' },
        { slug: 'communicating-results', name: 'Communicating results', description: 'Explain findings to non-technical people.', category: 'Communication' },
    ],
};

const MOCK_SKILL_RULES: Array<{
    pattern: RegExp;
    proposal: ProposedSkill;
}> = [
        { pattern: /\bsql\b/i, proposal: { skillSlug: 'sql', proposedLevel: 3, rationale: 'Mentions writing SQL queries for analysis.', confidence: 'high' } },
        { pattern: /excel|spreadsheet/i, proposal: { skillSlug: 'spreadsheets', proposedLevel: 3, rationale: 'Mentions regular spreadsheet work.', confidence: 'medium' } },
        { pattern: /python/i, proposal: { skillSlug: 'basic-python', proposedLevel: 2, rationale: 'Mentions using Python for scripts or analysis.', confidence: 'medium' } },
        { pattern: /pandas/i, proposal: { skillSlug: 'pandas', proposedLevel: 2, rationale: 'Mentions pandas, without much detail.', confidence: 'low' } },
        { pattern: /\bgit\b/i, proposal: { skillSlug: 'basic-git', proposedLevel: 2, rationale: 'Mentions version control with Git.', confidence: 'low' } },
    ];

const MOCK_UNMAPPED_RULES: Array<{ pattern: RegExp; skill: UnmappedSkill }> = [
    { pattern: /tableau/i, skill: { name: 'Tableau', proposedLevel: 2, rationale: 'Mentions building dashboards in Tableau.' } },
    { pattern: /power ?bi/i, skill: { name: 'Power BI', proposedLevel: 2, rationale: 'Mentions reports built in Power BI.' } },
];

export async function fetchRoles(): Promise<Result<RolesResponse>> {
    if (isMockMode()) {
        const mockState = getMockState();
        if (mockState === 'loading') return new Promise(() => { });
        await wait(MOCK_DELAY_MS);
        if (mockState === 'error') return mockHttpError(500, 'Simulated error state');
        if (mockState === 'empty') return { data: { roles: [] }, error: null };
        return { data: { roles: [MOCK_ROLE] }, error: null };
    }
    return apiClient<RolesResponse>('/api/roles');
}

export async function fetchLearner(): Promise<Result<Learner>> {
    if (isMockMode()) {
        const mockState = getMockState();
        if (mockState === 'loading') return new Promise(() => { });
        await wait(MOCK_DELAY_MS);
        if (mockState === 'error') return mockHttpError(500, 'Simulated error state');
        if (mockState === 'has-learner') {
            return { data: { id: 'mock-learner', name: 'Alex' }, error: null };
        }
        return mockHttpError(404, 'Learner not found.');
    }
    return apiClient<Learner>('/api/learner');
}

export async function extractProfile(text: string): Promise<Result<ProfileExtractResponse>> {
    if (isMockMode()) {
        const mockState = getMockState();
        await wait(MOCK_DELAY_MS);
        if (mockState === 'extract-error') return mockHttpError(502, 'The profile assistant is unavailable.');

        const proposedSkills = MOCK_SKILL_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.proposal);
        const unmappedSkills = MOCK_UNMAPPED_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.skill);
        const summary =
            proposedSkills.length > 0
                ? `Found evidence for ${proposedSkills.length} of the role's skills in your text.`
                : 'No clear evidence of the role skills was found in your text.';
        return { data: { proposedSkills, unmappedSkills, summary }, error: null };
    }
    return postJson<ProfileExtractResponse>('/api/profile/extract', { text });
}

export async function submitOnboarding(request: OnboardingRequest): Promise<Result<Learner>> {
    if (isMockMode()) {
        const mockState = getMockState();
        await wait(MOCK_DELAY_MS);
        if (mockState === 'conflict') return mockHttpError(409, 'A learner already exists.');
        if (mockState === 'submit-error') return mockHttpError(500, 'Simulated error state');
        return { data: { id: 'mock-learner', name: request.name }, error: null };
    }
    return postJson<Learner>('/api/onboarding', request);
}