import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    OnboardingWizard,
    executeOnboardingSubmit,
} from '@/components/onboarding/onboarding-wizard';
import { MOCK_ROLE } from '@/app/_lib/api/onboarding';
import * as onboardingApi from '@/app/_lib/api/onboarding';
import {
    buildOnboardingRequest,
    type OnboardingFormValues,
} from '@/app/onboarding/validation';

const validStepValues: OnboardingFormValues = {
    name: 'Alex Rivera',
    background: 'Economics degree, looking to transition into data analytics.',
    targetRoleId: MOCK_ROLE.id,
    weeklyHours: '12',
    declaredLevels: {
        sql: 2,
        spreadsheets: 3,
    },
    extraSkills: [{ name: 'Tableau', level: 1 }],
    tutorStyle: {
        language: 'es',
        tone: 'motivador',
        detailLevel: 'profundo',
        useAnalogies: true,
        freeInstructions: 'Please give real-world finance examples.',
    },
};

describe('Onboarding final step and submission flow', () => {
    let assignMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        assignMock = vi.fn();
        vi.stubGlobal('window', {
            location: {
                assign: assignMock,
                search: '',
            },
            scrollTo: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders the final CTA button and Back button on the Tutor style step', () => {
        const html = renderToStaticMarkup(
            <OnboardingWizard
                initialStep={2}
                initialRoles={[MOCK_ROLE]}
                initialValues={validStepValues}
            />
        );

        // Step title and descriptions
        expect(html).toContain('Tutor style');
        expect(html).toContain('Choose how you want explanations delivered.');
        expect(html).toContain('Language');
        expect(html).toContain('Tone');
        expect(html).toContain('Additional instructions');
        expect(html).toContain('Please give real-world finance examples.');

        // Buttons: final CTA and Back are present, Next is absent
        expect(html).toContain('Create my learning path');
        expect(html).toContain('Back');
        expect(html).not.toContain('>Next<');
    });

    it('renders loading/disabled state when submission is in progress', () => {
        const html = renderToStaticMarkup(
            <OnboardingWizard
                initialStep={2}
                initialRoles={[MOCK_ROLE]}
                initialValues={validStepValues}
                initialIsSubmitting={true}
            />
        );

        expect(html).toContain('Creating your learning path...');
        expect(html).toContain('disabled=""');
        expect(html).toContain('animate-spin');
    });

    it('renders error alert visibly when an API submission error occurs', () => {
        const html = renderToStaticMarkup(
            <OnboardingWizard
                initialStep={2}
                initialRoles={[MOCK_ROLE]}
                initialValues={validStepValues}
                initialSubmitError="A learner already exists for this account."
            />
        );

        expect(html).toContain('Unable to complete profile');
        expect(html).toContain('A learner already exists for this account.');
    });

    it('preserves all custom tutorStyle fields when building the complete request payload', () => {
        const roleSlugs = MOCK_ROLE.skills.map((s) => s.slug);
        const request = buildOnboardingRequest(validStepValues, roleSlugs);

        expect(request.name).toBe('Alex Rivera');
        expect(request.background).toBe('Economics degree, looking to transition into data analytics.');
        expect(request.targetRoleId).toBe(MOCK_ROLE.id);
        expect(request.weeklyHours).toBe(12);
        expect(request.declaredLevels.sql).toBe(2);
        expect(request.declaredLevels.spreadsheets).toBe(3);
        expect(request.extraSkills).toEqual([{ name: 'Tableau', level: 1 }]);

        // Tutor style fields preservation
        expect(request.tutorStyle).toEqual({
            language: 'es',
            tone: 'motivador',
            detailLevel: 'profundo',
            useAnalogies: true,
            freeInstructions: 'Please give real-world finance examples.',
        });
    });

    it('submits the complete payload to POST /api/onboarding and redirects to /dashboard on success', async () => {
        const submitSpy = vi.spyOn(onboardingApi, 'submitOnboarding').mockResolvedValue({
            data: { id: 'new-learner-id', name: 'Alex Rivera' },
            error: null,
        });

        const onSuccess = vi.fn();

        const result = await executeOnboardingSubmit({
            values: validStepValues,
            targetRole: MOCK_ROLE,
            onSuccess,
            submitFn: onboardingApi.submitOnboarding,
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 'new-learner-id', name: 'Alex Rivera' });
        expect(submitSpy).toHaveBeenCalledTimes(1);

        const submittedPayload = submitSpy.mock.calls[0][0];
        expect(submittedPayload.name).toBe('Alex Rivera');
        expect(submittedPayload.targetRoleId).toBe(MOCK_ROLE.id);
        expect(submittedPayload.weeklyHours).toBe(12);
        expect(submittedPayload.declaredLevels.sql).toBe(2);
        expect(submittedPayload.extraSkills).toEqual([{ name: 'Tableau', level: 1 }]);
        expect(submittedPayload.tutorStyle.language).toBe('es');
        expect(submittedPayload.tutorStyle.tone).toBe('motivador');
        expect(submittedPayload.tutorStyle.freeInstructions).toBe('Please give real-world finance examples.');

        expect(onSuccess).toHaveBeenCalledWith({ id: 'new-learner-id', name: 'Alex Rivera' });
    });

    it('redirects via window.location.assign to /dashboard by default on success', async () => {
        vi.spyOn(onboardingApi, 'submitOnboarding').mockResolvedValue({
            data: { id: 'new-learner-id', name: 'Alex Rivera' },
            error: null,
        });

        const result = await executeOnboardingSubmit({
            values: validStepValues,
            targetRole: MOCK_ROLE,
            submitFn: onboardingApi.submitOnboarding,
        });

        expect(result.success).toBe(true);
        expect(assignMock).toHaveBeenCalledWith('/dashboard');
    });

    it('handles API errors visibly without redirecting', async () => {
        const submitSpy = vi.spyOn(onboardingApi, 'submitOnboarding').mockResolvedValue({
            data: null,
            error: {
                type: 'http',
                message: 'A learner already exists.',
                status: 409,
            },
        });

        const result = await executeOnboardingSubmit({
            values: validStepValues,
            targetRole: MOCK_ROLE,
            submitFn: onboardingApi.submitOnboarding,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('A learner already exists.');
        expect(submitSpy).toHaveBeenCalledTimes(1);
        expect(assignMock).not.toHaveBeenCalled();
    });

    it('validates tutorStyle before submitting and rejects invalid data', async () => {
        const submitSpy = vi.spyOn(onboardingApi, 'submitOnboarding');

        const invalidValues: OnboardingFormValues = {
            ...validStepValues,
            tutorStyle: {
                ...validStepValues.tutorStyle,
                freeInstructions: 'a'.repeat(501), // exceeds limit
            },
        };

        const result = await executeOnboardingSubmit({
            values: invalidValues,
            targetRole: MOCK_ROLE,
            submitFn: onboardingApi.submitOnboarding,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('500 characters');
        expect(submitSpy).not.toHaveBeenCalled();
    });
});
